// frontend/src/components/ChatInterface.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropertyCard from './PropertyCard';
import './ChatInterface.css';

// Add this line at the top - it will use the Render URL in production, localhost in development
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://property-recommender-chat-bot.onrender.com';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState('light');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = theme || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Toggle between light and dark theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { 
      type: 'user', 
      content: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    try {
      // UPDATED LINE: Use environment variable instead of hardcoded URL
      const response = await fetch(`${API_BASE_URL}/api/properties/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [
          ...prev, 
          { 
            type: 'assistant', 
            content: data.summary,
            properties: data.properties || [],
            filters: data.filters || {},
            totalMatches: data.totalMatches || 0,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev, 
        { 
          type: 'assistant', 
          content: '❌ Sorry, I encountered an error. Please try again or check your connection.',
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatPropertyCount = (count) => {
    if (count === 0) return 'No properties';
    if (count === 1) return '1 property';
    return `${count} properties`;
  };

  return (
    <div className="chat-interface">
      {/* Theme Toggle Button */}
      <button 
        className="theme-toggle" 
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {/* Header */}
      <div className="chat-header">
        <div className="header-content">
          <h1>🏠 Property Search AI</h1>
          <p>Find your dream home with intelligent natural language search</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <div className="welcome-content">
              <h2>Welcome! 👋</h2>
              <p>I'm your AI-powered property assistant. Tell me what you're looking for, and I'll help you find the perfect home.</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message ${message.type} ${message.isError ? 'error' : ''}`}>
            <div className="message-content">
              <div className="message-header">
                <div className="sender-info">
                  <span className="sender-avatar">
                    {message.type === 'user' ? '👤' : '🤖'}
                  </span>
                  <strong className="sender-name">
                    {message.type === 'user' ? 'You' : 'AI Assistant'}
                  </strong>
                </div>
                <span className="timestamp">{message.timestamp}</span>
              </div>
              
              <div className="message-text">{message.content}</div>
              
              {/* Properties Grid */}
              {message.properties && message.properties.length > 0 && (
                <div className="properties-section">
                  <div className="properties-header">
                    <h4>
                      <span className="properties-icon">🏘️</span>
                      <span className="properties-title">
                        {formatPropertyCount(message.totalMatches)} Found
                      </span>
                    </h4>
                    {message.totalMatches > message.properties.length && (
                      <p className="showing-text">
                        Showing top {message.properties.length} matches
                      </p>
                    )}
                  </div>
                  <div className="property-grid">
                    {message.properties.map((property, idx) => (
                      <PropertyCard key={`${property.projectName}-${idx}`} property={property} />
                    ))}
                  </div>
                </div>
              )}

              {/* No Results Message */}
              {message.properties && message.properties.length === 0 && !message.isError && (
                <div className="no-results-message">
                  <div className="no-results-icon">🔍</div>
                  <p className="no-results-text">
                    No properties matched your search. Try adjusting your criteria.
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="message assistant loading">
            <div className="message-content">
              <div className="message-header">
                <div className="sender-info">
                  <span className="sender-avatar">🤖</span>
                  <strong className="sender-name">AI Assistant</strong>
                </div>
              </div>
              <div className="loading-indicator">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="loading-text">Searching properties...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-container">
        <div className="chat-input">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your dream property... (e.g., 3BHK flat in Pune under 1.2 Cr)"
            disabled={isLoading}
            aria-label="Property search input"
          />
          <button 
            onClick={handleSendMessage} 
            disabled={isLoading || !inputMessage.trim()}
            className="send-button"
            aria-label="Send message"
          >
            {isLoading ? (
              <span className="button-loader">⏳</span>
            ) : (
              <span className="button-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;