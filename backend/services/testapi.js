// backend/testapi.js
import Groq from "groq-sdk";

const GROQ_API_KEY = "xxx"; // Replace with your Groq API key

async function testGroqAPI() {
  console.log('🧪 Testing Groq API Key...');

  // Current active models as of 2024
  const currentModels = [
    "llama-3.1-8b-instant",  // Replacement for llama3-8b-8192
    "llama-3.1-70b-versatile",
    "llama-3.2-1b-preview", 
    "llama-3.2-3b-preview",
    "llama-guard-3-8b",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
  ];

  for (const model of currentModels) {
    try {
      console.log(`\n🔄 Testing model: ${model}`);
      
      const groq = new Groq({
        apiKey: GROQ_API_KEY
      });

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "user", content: "Hello! Respond in just 2 words." }
        ],
        model: model,
        temperature: 0.7,
        max_tokens: 10
      });

      console.log(`✅ ${model}: SUCCESS!`);
      console.log(`Response: "${chatCompletion.choices[0]?.message?.content}"`);
      return model; // Return the first working model

    } catch (error) {
      console.log(`❌ ${model}: ${error.message}`);
      
      // If it's just a model-specific error, continue to next model
      if (error.message.includes('model') && !error.message.includes('401')) {
        continue;
      }
      
      // If it's an auth error, break entirely
      if (error.status === 401) {
        console.log('💡 API Key is invalid or expired');
        break;
      }
    }
  }
  
  return null;
}

// Simple test with the most common current model
async function quickTest() {
  try {
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "user", content: "Say hello in 2 words" }
      ],
      model: "llama-3.1-8b-instant", // Current replacement
      max_tokens: 10
    });

    console.log('\n🎉 QUICK TEST SUCCESS!');
    console.log('Response:', chatCompletion.choices[0].message.content);
    return true;
    
  } catch (error) {
    console.log('\n❌ Quick test failed:', error.message);
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting Groq API Tests...\n');
  
  // First try quick test
  const quickSuccess = await quickTest();
  
  if (!quickSuccess) {
    console.log('\n🔧 Trying all available models...');
    const workingModel = await testGroqAPI();
    
    if (workingModel) {
      console.log(`\n🎉 Use this model in your application: ${workingModel}`);
    } else {
      console.log('\n💡 Solution:');
      console.log('1. Check available models at: https://console.groq.com/docs/models');
      console.log('2. Your API key is valid but models have changed');
    }
  }
}

runTests();