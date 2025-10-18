// backend/scripts/analyzeCSV.js
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

async function analyzeCSVFiles() {
  console.log('📊 ANALYZING CSV STRUCTURE...\n');
  
  const currentDir = process.cwd();
  console.log('Current directory:', currentDir);
  
  // Go up one level from scripts to backend, then to data
  const backendDir = path.dirname(currentDir); // This goes from scripts to backend
  const dataDir = path.join(backendDir, 'data');
  console.log('Data directory:', dataDir);
  
  if (!fs.existsSync(dataDir)) {
    console.log('❌ Data directory does not exist!');
    return;
  }
  
  const filesInDataDir = fs.readdirSync(dataDir);
  console.log('Files in data directory:', filesInDataDir);
  
  const files = [
    { name: 'project.csv', path: path.join(dataDir, 'project.csv') },
    { name: 'ProjectAddress.csv', path: path.join(dataDir, 'ProjectAddress.csv') },
    { name: 'ProjectConfiguration.csv', path: path.join(dataDir, 'ProjectConfiguration.csv') },
    { name: 'ProjectConfigurationVariant.csv', path: path.join(dataDir, 'ProjectConfigurationVariant.csv') }
  ];

  for (const file of files) {
    console.log(`\n=== ANALYZING ${file.name} ===`);
    console.log('Full path:', file.path);
    
    if (!fs.existsSync(file.path)) {
      console.log(`❌ File not found`);
      continue;
    }

    console.log(`✅ File found!`);
    const rows = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => {
          console.log(`   Total rows: ${rows.length}`);
          if (rows.length > 0) {
            console.log('   Columns:', Object.keys(rows[0]));
            console.log('   First 2 rows:');
            rows.slice(0, 2).forEach((row, index) => {
              console.log(`   Row ${index + 1}:`, JSON.stringify(row, null, 2));
            });
          }
          resolve();
        })
        .on('error', (error) => {
          console.log(`❌ Error reading file:`, error.message);
          resolve();
        });
    });
  }
}

analyzeCSVFiles();