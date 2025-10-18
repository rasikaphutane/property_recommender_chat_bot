// backend/services/geminiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI;
try {
  if (process.env.GROQ_API_KEY) {
    // We're using Groq now, but keeping the structure for consistency
  }
} catch (error) {
  console.log('🔧 Using enhanced parser and summary generator');
}

export class GeminiService {
  constructor() {
    this.llmAvailable = true;
    console.log('🚀 Using Groq LLM for filter extraction and summaries');
  }

  async extractFilters(userMessage) {
    console.log(`\n💬 Processing: "${userMessage}"`);
    
    // First check if it's a specific property query
    const lowerMessage = userMessage.toLowerCase();
    const specificKeywords = [
      'address of', 'details of', 'information about', 'show me', 
      'tell me about', 'where is', 'location of', 'full address of'
    ];
    
    const isSpecificQuery = specificKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    if (isSpecificQuery) {
      console.log('🎯 Specific property query detected');
      // Return empty filters to trigger specific property search
      return {};
    }
    
    try {
      return await this.useGroqLLM(userMessage);
    } catch (error) {
      console.log('❌ Groq failed, using enhanced parser:', error.message);
      return this.enhancedFilterExtraction(userMessage);
    }
  }

  async useGroqLLM(userMessage) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey || !apiKey.startsWith('gsk_')) {
      throw new Error('Invalid Groq API key');
    }

    const prompt = {
      messages: [
        {
          role: "system",
          content: `Extract real estate search filters from user message. Return ONLY valid JSON with these fields:
          {
            "city": "city name or null",
            "bhk": number or null,
            "maxPrice": number in rupees (convert "Cr" to 10000000, "Lakh" to 100000) or null,
            "locality": "area/locality or null", 
            "possession": "Ready to Move or Under Construction or null",
            "amenities": ["array", "of", "amenities"] or null
          }
          Examples:
          - "3BHK in Pune under 1.2 Cr" → {"city": "Pune", "bhk": 3, "maxPrice": 12000000, "locality": null, "possession": null, "amenities": null}
          - "2 bedroom flat in Mumbai" → {"city": "Mumbai", "bhk": 2, "maxPrice": null, "locality": null, "possession": null, "amenities": null}
          - "Ready to move apartment" → {"city": null, "bhk": null, "maxPrice": null, "locality": null, "possession": "Ready to Move", "amenities": null}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 500
    };

    console.log('🔄 Calling Groq API for filter extraction...');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prompt)
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('📨 Groq raw response:', content);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const filters = JSON.parse(jsonMatch[0]);
        console.log('🎯 Parsed filters:', filters);
        
        // Clean up the filters
        Object.keys(filters).forEach(key => {
          if (filters[key] === 'null' || filters[key] === null || filters[key] === '') {
            delete filters[key];
          }
        });
        
        return filters;
      } catch (parseError) {
        throw new Error(`JSON parse error: ${parseError.message}`);
      }
    }
    
    throw new Error('No JSON found in response');
  }

  async generateSmartSummary(properties, userQuery, filters) {
    console.log('📊 Generating smart summary for:', properties.length, 'properties');
    
    if (properties.length === 0) {
      return await this.generateNoResultsSummary(properties, userQuery, filters);
    }

    try {
      // Use Groq to generate a natural language summary
      return await this.generateGroqSummary(properties, userQuery, filters);
    } catch (error) {
      console.log('❌ Groq summary failed, using data-driven summary:', error.message);
      return this.generateDataDrivenSummary(properties, userQuery, filters);
    }
  }

  async generateGroqSummary(properties, userQuery, filters) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey || !apiKey.startsWith('gsk_')) {
      throw new Error('Groq API key not available');
    }

    // Prepare property data for the summary
    const propertyStats = this.calculatePropertyStats(properties);
    
    const prompt = {
      messages: [
        {
          role: "system",
          content: `You are a helpful real estate assistant. Generate a SHORT summary of 2-4 lines describing the best-matched properties using ONLY the provided CSV data.

IMPORTANT RULES:
- Use ONLY the data provided below - DO NOT make up or hallucinate any property details
- Keep it to 2-4 lines maximum
- Be concise and informative
- Mention key facts from the data: locations, price ranges, possession status, key amenities
- Focus on the most relevant information for the user's query
- Ground the summary ONLY in the CSV data provided
- If specific filters were applied, mention how they affected the results
- Do NOT mention any specific areas that are not in the data

Format your response as a natural, helpful summary.`
        },
        {
          role: "user",
          content: `User Query: "${userQuery}"
Applied Filters: ${JSON.stringify(filters)}

Property Data Summary:
- Total properties found: ${propertyStats.total}
- Cities: ${propertyStats.cities.join(', ')}
- Localities: ${propertyStats.localities.join(', ')}
- BHK range: ${propertyStats.bhkRange}
- Price range: ${propertyStats.priceRange}
- Possession: ${propertyStats.readyToMove} ready to move, ${propertyStats.underConstruction} under construction
- Top amenities: ${propertyStats.topAmenities.join(', ')}

Generate a 2-4 line summary using ONLY this data. Be specific about locations, prices, and key features.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 150
    };

    console.log('🔄 Calling Groq API for summary generation...');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prompt)
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;
    
    console.log('📝 Generated smart summary:', summary);
    return summary;
  }

  async generateNoResultsSummary(properties, userQuery, filters) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey || !apiKey.startsWith('gsk_')) {
      return this.generateBasicNoResultsSummary(userQuery, filters);
    }

    try {
      const prompt = {
        messages: [
          {
            role: "system",
            content: `You are a helpful real estate assistant. Politely inform the user that no properties were found and provide helpful suggestions based ONLY on available data.

IMPORTANT RULES:
- Be polite and helpful
- Do NOT suggest specific areas or locations that are not in the available data
- Suggest general adjustments like budget, BHK, or possession status
- Keep it to 2-3 lines maximum
- Do not make up or hallucinate any information

Example responses:
"I couldn't find properties matching your criteria. You might try adjusting your budget or BHK requirements."
"Unfortunately, no properties match your search. Consider expanding your location preferences or adjusting other filters."`
          },
          {
            role: "user",
            content: `User Query: "${userQuery}"
Applied Filters: ${JSON.stringify(filters)}
Available Cities in System: ${this.getAvailableCities(properties)}

Generate a polite 2-3 line response explaining no properties were found and suggesting general adjustments.`
          }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 120
      };

      console.log('🔄 Calling Groq API for no-results response...');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prompt)
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.choices[0].message.content;
      
      console.log('📝 Generated no-results response:', summary);
      return summary;

    } catch (error) {
      console.log('❌ Groq no-results failed, using basic response:', error.message);
      return this.generateBasicNoResultsSummary(userQuery, filters);
    }
  }

  getAvailableCities(properties) {
    const cities = [...new Set(properties.map(p => p.city))].filter(Boolean);
    return cities.length > 0 ? cities.join(', ') : 'No specific cities available';
  }

  generateBasicNoResultsSummary(userQuery, filters) {
    console.log('❌ No properties found for query:', userQuery);
    
    let summary = `I couldn't find any properties matching "${userQuery}".`;
    
    const suggestions = [];
    
    if (filters.maxPrice) {
      suggestions.push('adjusting your budget');
    }
    
    if (filters.bhk) {
      suggestions.push('trying different BHK configurations');
    }
    
    if (filters.city) {
      suggestions.push('expanding your location search');
    }
    
    if (filters.possession) {
      suggestions.push('considering different possession status');
    }
    
    if (suggestions.length > 0) {
      summary += ` You might try ${suggestions.join(' or ')}.`;
    } else {
      summary += ` Please try adjusting your search criteria.`;
    }

    return summary;
  }

  calculatePropertyStats(properties) {
    const cities = [...new Set(properties.map(p => p.city))].filter(Boolean);
    const localities = [...new Set(properties.map(p => p.locality))].filter(Boolean).slice(0, 3);
    const bhks = [...new Set(properties.map(p => p.bhk))].filter(Boolean).sort((a, b) => a - b);
    
    const prices = properties.map(p => p.price).filter(p => p && p > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    
    const readyToMove = properties.filter(p => p.possession === 'Ready to Move').length;
    const underConstruction = properties.filter(p => p.possession === 'Under Construction').length;
    
    // Calculate top amenities
    const allAmenities = properties.flatMap(p => p.amenities || []);
    const amenityCount = {};
    allAmenities.forEach(amenity => {
      amenityCount[amenity] = (amenityCount[amenity] || 0) + 1;
    });
    const topAmenities = Object.entries(amenityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([amenity]) => amenity);

    const matchingBHK = properties.filter(p => p.bhk).length;

    return {
      total: properties.length,
      cities: cities.length > 0 ? cities : ['Multiple cities'],
      localities: localities.length > 0 ? localities : ['Various areas'],
      bhkRange: bhks.length > 0 ? `${Math.min(...bhks)}-${Math.max(...bhks)} BHK` : 'Various configurations',
      priceRange: this.formatPriceRange(minPrice, maxPrice),
      readyToMove,
      underConstruction,
      matchingBHK,
      topAmenities: topAmenities.length > 0 ? topAmenities : ['Standard amenities']
    };
  }

  formatPriceRange(minPrice, maxPrice) {
    if (minPrice === 0 || maxPrice === 0) return 'Various price ranges';
    
    const formatPrice = (price) => {
      if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)} Cr`;
      if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
      return `₹${price}`;
    };
    
    return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
  }

  generateDataDrivenSummary(properties, userQuery, filters) {
    console.log('📊 Generating data-driven summary for:', properties.length, 'properties');
    
    const stats = this.calculatePropertyStats(properties);
    
    let summary = `I found ${stats.total} properties matching your search`;
    
    if (stats.cities.length > 0) {
      summary += ` in ${stats.cities.join(', ')}`;
    }
    
    if (stats.localities.length > 0 && stats.localities[0] !== 'Various areas') {
      summary += `, primarily in ${stats.localities.join(', ')}`;
    }
    
    summary += `. Price range: ${stats.priceRange}.`;
    
    if (stats.readyToMove > 0 || stats.underConstruction > 0) {
      const possessionInfo = [];
      if (stats.readyToMove > 0) possessionInfo.push(`${stats.readyToMove} ready to move`);
      if (stats.underConstruction > 0) possessionInfo.push(`${stats.underConstruction} under construction`);
      summary += ` ${possessionInfo.join(' and ')} options available.`;
    }
    
    if (filters.bhk && stats.matchingBHK > 0) {
      summary += ` ${stats.matchingBHK} properties match your ${filters.bhk}BHK requirement.`;
    }

    console.log('📝 Generated data-driven summary:', summary);
    return summary;
  }

  enhancedFilterExtraction(message) {
    const filters = {};
    const lowerMessage = message.toLowerCase();
    
    console.log('🔍 Enhanced parser analyzing:', message);

    // City extraction
    const cities = ['pune', 'mumbai', 'bangalore', 'delhi', 'hyderabad', 'chennai'];
    for (const city of cities) {
      if (lowerMessage.includes(city)) {
        filters.city = city;
        break;
      }
    }

    // BHK extraction
    const bhkPatterns = [
      /(\d)\s*bhk/i,
      /(\d)\s*bedroom/i,
      /(\d)\s*bed/i,
      /(\d)\s*b\/?h\/?k/i
    ];
    
    for (const pattern of bhkPatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        filters.bhk = parseInt(match[1]);
        break;
      }
    }

    // Budget extraction
    const budgetPatterns = [
      /under\s*₹?\s*(\d+(?:\.\d+)?)\s*(cr|crore)/i,
      /upto\s*₹?\s*(\d+(?:\.\d+)?)\s*(cr|crore)/i,
      /below\s*₹?\s*(\d+(?:\.\d+)?)\s*(cr|crore)/i,
      /under\s*₹?\s*(\d+(?:\.\d+)?)\s*(lakh|lac)/i,
      /(\d+(?:\.\d+)?)\s*(cr|crore)/i,
      /(\d+(?:\.\d+)?)\s*(lakh|lac)/i
    ];
    
    for (const pattern of budgetPatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        const amount = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        filters.maxPrice = (unit === 'cr' || unit === 'crore') ? amount * 10000000 : amount * 100000;
        console.log(`💰 Budget: ${amount} ${unit} = ${filters.maxPrice}`);
        break;
      }
    }

    // Locality extraction
    const localities = [
      'chembur', 'shivajinagar', 'ashoknagar', 'model colony', 'sindhi society',
      'wakad', 'baner', 'hinjewadi', 'kharadi', 'kothrud', 'andheri', 'bandra'
    ];
    
    for (const locality of localities) {
      if (lowerMessage.includes(locality)) {
        filters.locality = locality;
        break;
      }
    }

    // Possession extraction
    if (lowerMessage.includes('ready') || lowerMessage.includes('move in')) {
      filters.possession = 'Ready to Move';
    } else if (lowerMessage.includes('under construction')) {
      filters.possession = 'Under Construction';
    }

    console.log('🔧 Enhanced parser filters:', filters);
    return filters;
  }
}