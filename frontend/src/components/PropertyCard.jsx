// frontend/src/components/PropertyCard.jsx
import React, { useState } from 'react';

const PropertyCard = ({ property }) => {
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);

  const formatPrice = (price) => {
    if (!price || price === 0) return 'Price on request';
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
    return `₹${price}`;
  };

  const formatArea = (area) => {
    return area ? `${area} sq.ft` : 'Area not specified';
  };

  const getPossessionColor = (possession) => {
    return possession === 'Ready to Move' ? '#10b981' : '#ef4444';
  };

  const handleViewDetails = () => {
    setShowFullDetails(!showFullDetails);
    if (!showFullDetails) {
      setShowContactInfo(false);
    }
  };

  const handleContactBuilder = () => {
    setShowContactInfo(!showContactInfo);
    if (!showContactInfo) {
      setShowFullDetails(false);
    }
  };

  const toggleFullAddress = () => {
    setShowFullAddress(!showFullAddress);
  };

  return (
    <div className="property-card">
      <div className="property-details">
        <div className="property-header">
          <div className="property-title-section">
            <h3 className="property-title">{property.projectName || 'Unknown Project'}</h3>
            {property.builder && (
              <p className="property-builder">by {property.builder}</p>
            )}
          </div>
          <div 
            className="property-badge"
            style={{ backgroundColor: getPossessionColor(property.possession) }}
          >
            {property.possession || 'Not Specified'}
          </div>
        </div>
        
        <div className="property-location-section">
          <p className="property-location">
            <span className="location-icon">📍</span>
            <span className="location-text">
              {property.locality || 'Location not specified'}, {property.city || 'City not specified'}
            </span>
          </p>
          
          {property.fullAddress && (
            <div className="address-toggle-section">
              <button 
                className="address-toggle"
                onClick={toggleFullAddress}
              >
                {showFullAddress ? '▲ Hide Full Address' : '▼ Show Full Address'}
              </button>
              
              {showFullAddress && (
                <div className="full-address">
                  <div className="address-content">
                    <strong>Complete Address:</strong>
                    <p>{property.fullAddress}</p>
                    {property.pincode && (
                      <p className="pincode">PIN: {property.pincode}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="property-specs">
          <div className="spec-item">
            <span className="spec-label">Configuration</span>
            <span className="spec-value">{property.bhk || 'N/A'} BHK</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Area</span>
            <span className="spec-value">{formatArea(property.area)}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Price</span>
            <span className="spec-value price">{formatPrice(property.price)}</span>
          </div>
        </div>

        {/* Full Details Section */}
        {showFullDetails && (
          <div className="full-details-section">
            <h4 className="section-title">Property Details</h4>
            
            <div className="details-grid">
              {property.projectType && (
                <div className="detail-item">
                  <span className="detail-label">Project Type:</span>
                  <span className="detail-value">{property.projectType}</span>
                </div>
              )}
              {property.builder && (
                <div className="detail-item">
                  <span className="detail-label">Builder:</span>
                  <span className="detail-value">{property.builder}</span>
                </div>
              )}
              {property.status && (
                <div className="detail-item">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value">{property.status}</span>
                </div>
              )}
              {property.reraId && (
                <div className="detail-item">
                  <span className="detail-label">RERA ID:</span>
                  <span className="detail-value">{property.reraId}</span>
                </div>
              )}
            </div>
            
            {property.amenities && property.amenities.length > 0 && (
              <div className="amenities-section">
                <h5 className="amenities-title">Amenities & Features</h5>
                <div className="amenities-list-full">
                  {property.amenities.map((amenity, index) => (
                    <span key={index} className="amenity-tag-full">
                      ✓ {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contact Info Section */}
        {showContactInfo && (
          <div className="contact-info-section">
            <div className="contact-details">
              <h4 className="section-title">Contact Information</h4>
              
              <div className="contact-info-grid">
                <div className="contact-item">
                  <span className="contact-label">Builder:</span>
                  <span className="contact-value">{property.builder || 'Not specified'}</span>
                </div>
                <div className="contact-item">
                  <span className="contact-label">Property Size:</span>
                  <span className="contact-value">{formatArea(property.area)}</span>
                </div>
                <div className="contact-item">
                  <span className="contact-label">Location:</span>
                  <span className="contact-value">{property.locality}, {property.city}</span>
                </div>
                <div className="contact-item">
                  <span className="contact-label">Price:</span>
                  <span className="contact-value">{formatPrice(property.price)}</span>
                </div>
              </div>
              
              <div className="contact-actions">
                <button className="btn-contact btn-contact-call">
                  <span className="btn-icon">📞</span>
                  <span className="btn-text">Call Builder</span>
                </button>
                <button className="btn-contact btn-contact-email">
                  <span className="btn-icon">✉️</span>
                  <span className="btn-text">Email Inquiry</span>
                </button>
                <button className="btn-contact btn-contact-visit">
                  <span className="btn-icon">📍</span>
                  <span className="btn-text">Site Visit</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="property-actions">
          <button 
            className={`btn-primary ${showFullDetails ? 'active' : ''}`}
            onClick={handleViewDetails}
          >
            <span className="btn-icon">{showFullDetails ? '👁️' : '📋'}</span>
            <span className="btn-text">{showFullDetails ? 'Hide Details' : 'View Details'}</span>
          </button>
          <button 
            className={`btn-secondary ${showContactInfo ? 'active' : ''}`}
            onClick={handleContactBuilder}
          >
            <span className="btn-icon">{showContactInfo ? '✕' : '📞'}</span>
            <span className="btn-text">{showContactInfo ? 'Hide Contact' : 'Contact'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;