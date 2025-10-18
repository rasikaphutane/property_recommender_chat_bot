// backend/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path'; 
import { processPropertyData } from './scripts/processdata.js';
import { GeminiService } from './services/geminiService.js';
import fs from 'fs';
// In server.js, right after your imports
//import dotenv from 'dotenv';
dotenv.config();

// ADD THIS DEBUG CODE
console.log('🔍 ENVIRONMENT DEBUG:');
console.log('Current directory:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
console.log('GROQ_API_KEY value:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 10) + '...' : 'NOT FOUND');
console.log('---');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const geminiService = new GeminiService();

// CORS configuration - MODIFIED SECTION
/*app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://property-recommender-chat-bot.netlify.app/'
  ],
  credentials: true
}));*/
app.use(cors());

app.use(express.json());

// Load property data
let propertyData = [];

const loadData = async () => {
  try {
    const backendDir = process.cwd();
    const dataPath = path.join(backendDir, 'data', 'processedProperties.json');
    
    if (fs.existsSync(dataPath)) {
      propertyData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      console.log(`✅ Loaded ${propertyData.length} properties from processed data`);
    } else {
      console.log('🔄 Processing CSV files...');
      propertyData = await processPropertyData();
    }
  } catch (error) {
    console.error('❌ Error loading data:', error);
    propertyData = [];
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Property Chatbot API is running',
    data: { totalProperties: propertyData.length }
  });
});

// Property-specific search
function searchSpecificProperty(query, properties) {
  const lowerQuery = query.toLowerCase();
  
  // Direct project name match
  const exactMatch = properties.find(property => 
    property.projectName.toLowerCase().includes(lowerQuery)
  );
  
  if (exactMatch) {
    return [exactMatch];
  }
  
  // Partial project name match
  const partialMatches = properties.filter(property =>
    property.projectName.toLowerCase().includes(lowerQuery) ||
    (property.fullAddress && property.fullAddress.toLowerCase().includes(lowerQuery))
  );
  
  return partialMatches;
}

// Enhanced filter application
function applyFilters(properties, filters) {
  let results = [...properties];

  // Apply filters only if they exist
  if (filters.city) {
    results = results.filter(property => 
      property.city && property.city.toLowerCase().includes(filters.city.toLowerCase())
    );
  }

  if (filters.bhk) {
    results = results.filter(property => property.bhk === filters.bhk);
  }

  if (filters.maxPrice) {
    results = results.filter(property => property.price <= filters.maxPrice);
  }

  if (filters.locality && filters.locality !== 'null') {
    results = results.filter(property => 
      property.locality && property.locality.toLowerCase().includes(filters.locality.toLowerCase())
    );
  }

  if (filters.possession && filters.possession !== 'null') {
    results = results.filter(property => 
      property.possession && property.possession.toLowerCase().includes(filters.possession.toLowerCase())
    );
  }

  return results;
}

// Main chat endpoint - ENHANCED
app.post('/api/properties/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('\n💬 User query:', message);

    // Check if this is a specific property query
    const specificProperties = searchSpecificProperty(message, propertyData);
    
    if (specificProperties.length > 0) {
      console.log('🎯 Specific property query detected');
      
      const summary = `I found information about "${specificProperties[0].projectName}":`;
      
      return res.json({
        success: true,
        summary,
        properties: specificProperties,
        isSpecificProperty: true,
        totalMatches: specificProperties.length
      });
    }

    // Regular filter-based search
    const filters = await geminiService.extractFilters(message);
    console.log('🎯 Extracted filters:', filters);

    let results = applyFilters(propertyData, filters);
    console.log('🔍 Filtered results:', results.length);

    // Generate summary
    const summary = await geminiService.generateSmartSummary(results, message, filters);

    // Return properties
    const responseProperties = results.slice(0, 8).map(property => ({
      id: property.id,
      projectName: property.projectName,
      city: property.city,
      locality: property.locality,
      bhk: property.bhk,
      price: property.price,
      possession: property.possession,
      amenities: property.amenities || ['Security', 'Water Supply', 'Power Backup'],
      area: property.area,
      slug: property.slug,
      builder: property.builder,
      fullAddress: property.fullAddress // Include full address in response
    }));

    res.json({
      success: true,
      summary,
      properties: responseProperties,
      filters,
      totalMatches: results.length
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error processing your request.'
    });
  }
});

// Get specific property by name
app.get('/api/properties/search/:query', (req, res) => {
  const { query } = req.params;
  const results = searchSpecificProperty(query, propertyData);
  
  res.json({
    success: true,
    properties: results,
    totalMatches: results.length
  });
});

// Get all properties (for debugging)
app.get('/api/properties/all', (req, res) => {
  const { limit = 50 } = req.query;
  res.json({
    properties: propertyData.slice(0, parseInt(limit)),
    total: propertyData.length
  });
});

// Debug endpoint
app.get('/api/debug/data', (req, res) => {
  const sampleData = propertyData.slice(0, 5).map(p => ({
    name: p.projectName,
    city: p.city,
    locality: p.locality,
    bhk: p.bhk,
    price: p.price,
    possession: p.possession,
    area: p.area,
    fullAddress: p.fullAddress
  }));
  
  res.json({
    totalProperties: propertyData.length,
    sample: sampleData,
    cities: [...new Set(propertyData.map(p => p.city))].filter(Boolean)
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Starting server...`);
  await loadData();
  console.log(`🏠 Property Chatbot API running on http://localhost:${PORT}`);
});