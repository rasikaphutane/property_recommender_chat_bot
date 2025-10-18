// backend/scripts/processData.js
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

class DataProcessor {
  constructor() {
    this.projects = [];
    this.addresses = [];
    this.configurations = [];
    this.variants = [];
    this.validCities = new Set();
    this.validLocalities = new Set();
  }

  async loadAllData() {
    try {
      console.log('📂 Loading CSV files...');
      
      const backendDir = path.dirname(process.cwd());
      const dataDir = path.join(backendDir, 'data');
      
      await this.loadCSV(path.join(dataDir, 'project.csv'), this.projects);
      await this.loadCSV(path.join(dataDir, 'ProjectAddress.csv'), this.addresses);
      await this.loadCSV(path.join(dataDir, 'ProjectConfiguration.csv'), this.configurations);
      await this.loadCSV(path.join(dataDir, 'ProjectConfigurationVariant.csv'), this.variants);
      
      console.log('✅ CSV files loaded:');
      console.log(`   - Projects: ${this.projects.length}`);
      console.log(`   - Addresses: ${this.addresses.length}`);
      console.log(`   - Configurations: ${this.configurations.length}`);
      console.log(`   - Variants: ${this.variants.length}`);
      
      return this.mergeData();
    } catch (error) {
      console.error('❌ Error loading data:', error);
      throw error;
    }
  }

  async loadCSV(filePath, storageArray) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File not found: ${filePath}`);
        resolve();
        return;
      }

      console.log(`   Loading ${path.basename(filePath)}...`);
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => storageArray.push(data))
        .on('end', () => {
          console.log(`   ✅ ${path.basename(filePath)}: ${storageArray.length} records`);
          resolve();
        })
        .on('error', reject);
    });
  }

  analyzeDataPatterns() {
    console.log('\n🔍 Analyzing data patterns...');
    
    // Analyze cities from addresses
    this.addresses.forEach(address => {
      if (address.fullAddress) {
        const location = this.extractLocationGeneric(address.fullAddress);
        if (location.city) this.validCities.add(location.city);
        if (location.locality) this.validLocalities.add(location.locality);
      }
    });

    console.log(`   - Found cities: ${Array.from(this.validCities).join(', ')}`);
    console.log(`   - Found localities: ${Array.from(this.validLocalities).join(', ')}`);

    // Analyze price ranges
    const prices = this.variants
      .map(v => this.parsePriceGeneric(v.price))
      .filter(p => p && p > 0);
    
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      console.log(`   - Price range: ${this.formatPrice(minPrice)} - ${this.formatPrice(maxPrice)}`);
    }

    // Analyze BHK patterns
    const bhks = this.configurations
      .map(config => this.extractBHKGeneric(config.type))
      .filter(bhk => bhk && bhk > 0);
    
    if (bhks.length > 0) {
      const uniqueBhks = [...new Set(bhks)].sort();
      console.log(`   - BHK types: ${uniqueBhks.join(', ')}`);
    }
  }

  mergeData() {
    console.log('🔄 Merging data from all CSV files...');
    
    // First analyze the data to understand patterns
    this.analyzeDataPatterns();
    
    const mergedData = [];

    // Process each project
    this.projects.forEach(project => {
      const address = this.addresses.find(addr => addr.projectId === project.id);
      const projectConfigs = this.configurations.filter(config => config.projectId === project.id);
      
      projectConfigs.forEach(config => {
        const configVariants = this.variants.filter(variant => variant.configurationId === config.id);
        
        if (configVariants.length === 0) {
          const property = this.createPropertyEntry(project, config, null, address);
          if (property) mergedData.push(property);
        } else {
          configVariants.forEach(variant => {
            const property = this.createPropertyEntry(project, config, variant, address);
            if (property) mergedData.push(property);
          });
        }
      });
    });

    console.log(`\n📊 Data Merge Results:`);
    console.log(`   - Total properties created: ${mergedData.length}`);
    
    // Apply intelligent filtering based on actual data patterns
    const validProperties = this.filterValidProperties(mergedData);
    
    console.log(`   - Valid properties after filtering: ${validProperties.length}`);
    
    // Show final statistics
    this.showFinalStatistics(validProperties);

    return validProperties;
  }

  createPropertyEntry(project, config, variant, address) {
    try {
      const bhk = this.extractBHKGeneric(config.type);
      const price = this.parsePriceGeneric(variant?.price);
      const area = this.parseAreaGeneric(variant?.carpetArea);
      const location = this.extractLocationGeneric(address?.fullAddress, project.projectName);

      // Debug logging for price issues
      if (variant?.price && (!price || price > 1000000000)) {
        console.log(`💰 Price debug: ${variant.price} -> parsed as ${price} for ${project.projectName}`);
      }

      // Validate essential fields
      if (!bhk || !price || !area || !location.city) {
        if (!bhk) console.log(`❌ No BHK for: ${project.projectName}`);
        if (!price) console.log(`❌ No valid price for: ${project.projectName} - ${variant?.price}`);
        if (!area) console.log(`❌ No valid area for: ${project.projectName} - ${variant?.carpetArea}`);
        if (!location.city) console.log(`❌ No city for: ${project.projectName} - ${address?.fullAddress}`);
        return null;
      }

      return {
        id: variant?.id || config.id,
        projectName: project.projectName,
        city: location.city,
        locality: location.locality,
        bhk: bhk,
        price: price,
        possession: this.parsePossessionGeneric(project.status),
        area: area,
        amenities: this.extractAmenitiesGeneric(variant?.aboutProperty, bhk),
        slug: project.slug,
        builder: this.extractBuilderGeneric(project.projectName),
        fullAddress: address?.fullAddress,
        pincode: address?.pincode,
        projectType: project.projectType,
        status: project.status,
        reraId: this.parseReraId(project.reraId),
        projectId: project.id,
        configId: config.id,
        variantId: variant?.id,
        propertyImages: this.parseImages(variant?.propertyImages),
        floorPlanImage: variant?.floorPlanImage
      };
    } catch (error) {
      console.warn(`⚠️ Error creating property entry: ${error.message}`);
      return null;
    }
  }

  extractBHKGeneric(configuration) {
    if (!configuration) return null;
    
    const configStr = configuration.toString();
    const bhkMatch = configStr.match(/(\d+)\s*BHK/i);
    return bhkMatch ? parseInt(bhkMatch[1]) : null;
  }

  parsePriceGeneric(priceStr) {
    if (!priceStr) return null;
    
    try {
      const cleanPrice = priceStr.toString().replace(/[^\d.]/g, '');
      const price = parseFloat(cleanPrice);
      
      if (isNaN(price) || price <= 0) return null;
      
      // Check for unrealistic prices and handle unit conversion properly
      if (price < 100) {
        // Too small to be actual price, skip
        return null;
      } else if (price < 1000) {
        // Likely in lakhs (e.g., 80 = 80 lakhs)
        return price * 100000;
      } else if (price < 100000) {
        // Could be in lakhs or actual amount - use context
        // If it looks like a lakh amount (e.g., 80, 120, etc.)
        if (price <= 200 && price % 10 === 0) {
          return price * 100000; // Convert lakhs to rupees
        }
        // Otherwise treat as actual rupees
        return price;
      } else if (price > 500000000) { // Above 50 Cr
        // Unrealistic price, skip
        console.log(`⚠️ Skipping unrealistic price: ${price}`);
        return null;
      } else {
        // Already in rupees and reasonable
        return price;
      }
      
    } catch (error) {
      console.log(`⚠️ Price parsing error for: ${priceStr}`);
      return null;
    }
  }

  parseAreaGeneric(areaStr) {
    if (!areaStr) return null;
    
    try {
      const area = parseFloat(areaStr.toString().replace(/[^\d.]/g, ''));
      
      // Validate area ranges
      if (isNaN(area) || area <= 0) return null;
      
      // Unrealistically small areas (less than 300 sq.ft)
      if (area < 300) return null;
      
      // Unrealistically large areas (more than 5000 sq.ft for apartments)
      if (area > 5000) return null;
      
      return area;
    } catch (error) {
      return null;
    }
  }

  parsePossessionGeneric(status) {
    if (!status) return 'Unknown';
    
    const statusStr = status.toString().toLowerCase();
    
    if (statusStr.includes('ready')) return 'Ready to Move';
    if (statusStr.includes('under')) return 'Under Construction';
    if (statusStr.includes('new')) return 'New Launch';
    
    return 'Unknown';
  }

  extractLocationGeneric(fullAddress, projectName) {
    if (!fullAddress) return { city: null, locality: null };

    const searchText = [fullAddress, projectName].filter(Boolean).join(' ').toLowerCase();
    
    // Extract city - use common Indian city patterns
    let foundCity = null;
    const cityPatterns = [
      { pattern: /\b(mumbai|bombay)\b/, city: 'Mumbai' },
      { pattern: /\b(pune|poona)\b/, city: 'Pune' },
      { pattern: /\b(bangalore|bengaluru)\b/, city: 'Bangalore' },
      { pattern: /\b(delhi|new delhi)\b/, city: 'Delhi' },
      { pattern: /\b(hyderabad|secunderabad)\b/, city: 'Hyderabad' },
      { pattern: /\b(chennai|madras)\b/, city: 'Chennai' },
      { pattern: /\b(kolkata|calcutta)\b/, city: 'Kolkata' },
      { pattern: /\b(ahmedabad|ahmadabad)\b/, city: 'Ahmedabad' },
      { pattern: /\b(surat)\b/, city: 'Surat' },
      { pattern: /\b(jaipur)\b/, city: 'Jaipur' }
    ];

    for (const { pattern, city } of cityPatterns) {
      if (pattern.test(searchText)) {
        foundCity = city;
        break;
      }
    }

    // Extract locality using generic patterns
    let foundLocality = null;
    if (fullAddress) {
      // Generic locality extraction patterns
      const localityPatterns = [
        // Pattern 1: Look for area names after location indicators
        /(?:near|beside|opposite to|at|in|area|locality|sector)\s+([a-z\s]{3,30})(?=,|\.|$)/i,
        
        // Pattern 2: Common Indian residential area suffixes
        /([a-z\s]+)(?:\s+(nagar|colony|society|vihar|enclave|estate|park|gardens|road|street|lane))(?=,|\.|$)/i,
        
        // Pattern 3: First meaningful part of address (before city)
        /^([^,]{5,50})(?=,?\s*(?:mumbai|pune|bangalore|delhi|hyderabad|chennai|kolkata))/i,
        
        // Pattern 4: Any capitalized words that aren't cities
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?=,|\s+(?:mumbai|pune|bangalore|delhi|hyderabad))/,
        
        // Pattern 5: Common address patterns with numbers
        /(?:survey no\.|plot no\.|sector no\.)\s*[a-z0-9]+\s*,\s*([^,]+)/i
      ];

      for (const pattern of localityPatterns) {
        const match = fullAddress.match(pattern);
        if (match && match[1]) {
          let potentialLocality = match[1].trim();
          
          // Clean up the extracted locality
          potentialLocality = potentialLocality
            .replace(/^\s*(?:near|beside|opposite to|at|in|area|locality|sector)\s+/i, '')
            .replace(/\s+/, ' ')
            .trim();
          
          if (this.isValidLocality(potentialLocality, foundCity)) {
            foundLocality = this.capitalizeWords(potentialLocality);
            break;
          }
        }
      }

      // Fallback: Use the first part of address that's not a city
      if (!foundLocality) {
        const parts = fullAddress.split(',');
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed && this.isValidLocality(trimmed, foundCity)) {
            foundLocality = this.capitalizeWords(trimmed);
            break;
          }
        }
      }
    }

    return { city: foundCity, locality: foundLocality };
  }

  isValidLocality(locality, city) {
    if (!locality || locality.length < 3) return false;
    
    const localityLower = locality.toLowerCase();
    
    // Common words that shouldn't be considered as localities
    const invalidWords = [
      'survey', 'plot', 'sector', 'number', 'no', 'road', 'street', 'lane', 
      'avenue', 'marg', 'near', 'beside', 'opposite', 'at', 'in', 'area',
      'locality', 'and', 'the', 'a', 'an', 'to', 'of', 'for', 'beside godrej',
      'opposite to mca', 'stadium', 'school', 'college', 'hospital', 'mamurdi',
      'thite', 'nagar', 'sai'
    ];
    
    // Check if it contains invalid words only
    const words = localityLower.split(/\s+/);
    const hasValidWords = words.some(word => 
      word.length > 2 && !invalidWords.includes(word)
    );
    
    if (!hasValidWords) return false;
    
    // Check if it's not a city name
    const isCity = this.looksLikeCity(localityLower);
    if (isCity) return false;
    
    // Check if it's not just numbers or special characters
    const hasLetters = /[a-zA-Z]/.test(locality);
    if (!hasLetters) return false;
    
    return true;
  }

  looksLikeCity(text) {
    const cityPatterns = [
      /\b(mumbai|pune|bangalore|delhi|hyderabad|chennai|kolkata|ahmedabad|surat|jaipur)\b/i
    ];
    return cityPatterns.some(pattern => pattern.test(text.toLowerCase()));
  }

  extractAmenitiesGeneric(aboutProperty, bhk) {
    const baseAmenities = ['Security', 'Water Supply', 'Power Backup'];
    
    if (aboutProperty) {
      const about = aboutProperty.toString().toLowerCase();
      const amenityKeywords = {
        'Swimming Pool': ['swimming', 'pool'],
        'Gym': ['gym', 'fitness'],
        'Park': ['park', 'garden'],
        'Club House': ['club', 'clubhouse'],
        'Lift': ['lift', 'elevator'],
        'Parking': ['parking', 'car park'],
        'Play Area': ['play', 'children']
      };

      for (const [amenity, keywords] of Object.entries(amenityKeywords)) {
        if (keywords.some(keyword => about.includes(keyword))) {
          baseAmenities.push(amenity);
        }
      }
    }

    // Add amenities based on property size
    if (bhk >= 3) {
      baseAmenities.push('Club House', 'Swimming Pool');
    }

    return [...new Set(baseAmenities)];
  }

  extractBuilderGeneric(projectName) {
    if (!projectName) return 'Unknown Builder';
    
    const name = projectName.toString().trim();
    const words = name.split(' ');
    return words.length > 1 ? words[0] + ' Builders' : name + ' Builders';
  }

  parseReraId(reraId) {
    if (!reraId) return null;
    
    try {
      // Handle RERA ID format like "[\"P99000056045\"]"
      const match = reraId.match(/["']([^"']+)["']/);
      return match ? match[1] : reraId;
    } catch (error) {
      return reraId;
    }
  }

  parseImages(imagesStr) {
    if (!imagesStr) return [];
    
    try {
      // Handle image format like "[\"https://example.com/image.jpg\"]"
      const match = imagesStr.match(/\[(.*)\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  filterValidProperties(properties) {
    // More realistic price ranges for Indian real estate
    const MIN_REASONABLE_PRICE = 500000;   // 5 Lakhs
    const MAX_REASONABLE_PRICE = 500000000; // 50 Crores
    
    // More realistic area ranges
    const MIN_REASONABLE_AREA = 300;    // 300 sq.ft
    const MAX_REASONABLE_AREA = 5000;   // 5000 sq.ft

    return properties.filter(property => {
      // Check price validity
      if (!property.price || 
          property.price < MIN_REASONABLE_PRICE || 
          property.price > MAX_REASONABLE_PRICE) {
        console.log(`⚠️ Skipping property due to price: ${property.projectName} - ₹${property.price}`);
        return false;
      }
      
      // Check area validity
      if (!property.area || 
          property.area < MIN_REASONABLE_AREA || 
          property.area > MAX_REASONABLE_AREA) {
        console.log(`⚠️ Skipping property due to area: ${property.projectName} - ${property.area} sq.ft`);
        return false;
      }
      
      // Check BHK validity
      if (!property.bhk || property.bhk < 1 || property.bhk > 10) {
        return false;
      }
      
      // Check if city exists
      if (!property.city) {
        return false;
      }
      
      return true;
    });
  }

  showFinalStatistics(properties) {
    if (properties.length === 0) return;

    const cities = [...new Set(properties.map(p => p.city))].filter(Boolean);
    const bhks = [...new Set(properties.map(p => p.bhk))].filter(Boolean).sort((a, b) => a - b);
    const prices = properties.map(p => p.price);
    const areas = properties.map(p => p.area);

    console.log(`   - Final cities: ${cities.join(', ')}`);
    console.log(`   - Final BHK types: ${bhks.join(', ')}`);
    console.log(`   - Final price range: ${this.formatPrice(Math.min(...prices))} - ${this.formatPrice(Math.max(...prices))}`);
    console.log(`   - Final area range: ${Math.min(...areas)} - ${Math.max(...areas)} sq.ft`);

    console.log('\n🔍 Sample final properties:');
    properties.slice(0, 3).forEach((prop, i) => {
      console.log(`   ${i+1}. ${prop.projectName} | ${prop.city} | ${prop.locality || 'N/A'} | ${prop.bhk}BHK | ${this.formatPrice(prop.price)} | ${prop.area} sq.ft`);
    });
  }

  formatPrice(price) {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
    return `₹${price}`;
  }

  capitalizeWords(str) {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }
}

// Export function to be used in the main application
export const processPropertyData = async () => {
  const processor = new DataProcessor();
  const processedData = await processor.loadAllData();
  
  const backendDir = path.dirname(process.cwd());
  const outputPath = path.join(backendDir, 'data', 'processedProperties.json');
  fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
  console.log(`\n💾 Processed data saved to ${outputPath}`);
  
  return processedData;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  processPropertyData().then(() => {
    console.log('🎉 Data processing completed!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Data processing failed:', error);
    process.exit(1);
  });
}