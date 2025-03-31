#!/usr/bin/env node
// src/scripts/analyze-test-cases.ts

import fs from 'fs';
import path from 'path';
import { ItemDetails } from '../ItemDetails';
import { OrderDetails } from '../OrderDetails';

/**
 * Analyzes captured test cases to identify patterns and issues.
 * This tool helps you understand what went wrong and how to fix it.
 */

interface IssueInfo {
  issueType: string;
  orderId: string;
  timestamp: string;
  itemCountBefore: number;
  itemCountAfter: number;
  itemsWithPrices: number;
  itemsWithoutPrices: number;
}

interface TestCase {
  id: string;
  directory: string;
  issueInfo: IssueInfo;
  originalOrder?: OrderDetails;
  processedItems?: ItemDetails[];
  html?: string;
  error?: any;
}

async function analyzeTestCases() {
  const capturedDir = path.join(process.cwd(), 'src', 'tests', 'captured');
  
  if (!fs.existsSync(capturedDir)) {
    console.log('No captured test cases found.');
    return;
  }
  
  // Get all subdirectories
  const testCaseDirs = fs.readdirSync(capturedDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  if (testCaseDirs.length === 0) {
    console.log('No test cases found in the captured directory.');
    return;
  }
  
  console.log(`Found ${testCaseDirs.length} test cases.`);
  
  // Load all test cases
  const testCases: TestCase[] = [];
  
  for (const dir of testCaseDirs) {
    const testCaseDir = path.join(capturedDir, dir);
    const testCase: TestCase = {
      id: dir,
      directory: testCaseDir,
      issueInfo: { 
        issueType: 'unknown',
        orderId: 'unknown',
        timestamp: 'unknown',
        itemCountBefore: 0,
        itemCountAfter: 0,
        itemsWithPrices: 0,
        itemsWithoutPrices: 0
      }
    };
    
    // Load issue info
    const issueInfoPath = path.join(testCaseDir, 'issue-info.json');
    if (fs.existsSync(issueInfoPath)) {
      testCase.issueInfo = JSON.parse(fs.readFileSync(issueInfoPath, 'utf-8'));
    }
    
    // Load original order
    const originalOrderPath = path.join(testCaseDir, 'original-order.json');
    if (fs.existsSync(originalOrderPath)) {
      testCase.originalOrder = JSON.parse(fs.readFileSync(originalOrderPath, 'utf-8'));
    }
    
    // Load processed items
    const processedItemsPath = path.join(testCaseDir, 'processed-items.json');
    if (fs.existsSync(processedItemsPath)) {
      testCase.processedItems = JSON.parse(fs.readFileSync(processedItemsPath, 'utf-8'));
    }
    
    // Load HTML (just check if it exists)
    const htmlPath = path.join(testCaseDir, 'shipment-elements.html');
    if (fs.existsSync(htmlPath)) {
      testCase.html = fs.readFileSync(htmlPath, 'utf-8');
    }
    
    // Load error
    const errorPath = path.join(testCaseDir, 'error.json');
    if (fs.existsSync(errorPath)) {
      testCase.error = JSON.parse(fs.readFileSync(errorPath, 'utf-8'));
    }
    
    testCases.push(testCase);
  }
  
  // Organize test cases by issue type
  const testCasesByIssueType: Record<string, TestCase[]> = {};
  
  for (const testCase of testCases) {
    const issueType = testCase.issueInfo.issueType || 'unknown';
    if (!testCasesByIssueType[issueType]) {
      testCasesByIssueType[issueType] = [];
    }
    testCasesByIssueType[issueType].push(testCase);
  }
  
  // Print summary
  console.log('\nTest Case Summary:');
  console.log('=================\n');
  
  for (const [issueType, cases] of Object.entries(testCasesByIssueType)) {
    console.log(`Issue Type: ${issueType}`);
    console.log(`Count: ${cases.length}`);
    console.log('');
    
    // Print some examples
    for (let i = 0; i < Math.min(3, cases.length); i++) {
      const testCase = cases[i];
      console.log(`  ${i + 1}. Test Case: ${testCase.id}`);
      console.log(`     Order ID: ${testCase.issueInfo.orderId}`);
      console.log(`     Item Count Before: ${testCase.issueInfo.itemCountBefore}`);
      console.log(`     Item Count After: ${testCase.issueInfo.itemCountAfter}`);
      console.log(`     Items With Prices: ${testCase.issueInfo.itemsWithPrices}`);
      console.log(`     Items Without Prices: ${testCase.issueInfo.itemsWithoutPrices}`);
      console.log(`     Directory: ${testCase.directory}`);
      console.log('');
    }
    
    if (cases.length > 3) {
      console.log(`  ... and ${cases.length - 3} more.`);
    }
    
    console.log('');
  }
  
  // Print the most recent test cases
  console.log('\nMost Recent Test Cases:');
  console.log('======================\n');
  
  const sortedTestCases = [...testCases].sort((a, b) => {
    const aTime = new Date(a.issueInfo.timestamp).getTime();
    const bTime = new Date(b.issueInfo.timestamp).getTime();
    return bTime - aTime; // Sort descending (most recent first)
  });
  
  for (let i = 0; i < Math.min(5, sortedTestCases.length); i++) {
    const testCase = sortedTestCases[i];
    console.log(`${i + 1}. ${testCase.id}`);
    console.log(`   Issue Type: ${testCase.issueInfo.issueType}`);
    console.log(`   Timestamp: ${testCase.issueInfo.timestamp}`);
    console.log(`   Directory: ${testCase.directory}`);
    console.log('');
  }
  
  // Find duplicate-items test cases and analyze them
  const duplicateItemsTestCases = testCasesByIssueType['duplicate-items'] || [];
  
  if (duplicateItemsTestCases.length > 0) {
    console.log('\nDuplicate Items Analysis:');
    console.log('=======================\n');
    
    for (const testCase of duplicateItemsTestCases) {
      if (testCase.processedItems) {
        // Count occurrences of each item title
        const titleCounts: Record<string, number> = {};
        
        for (const item of testCase.processedItems) {
          titleCounts[item.title] = (titleCounts[item.title] || 0) + 1;
        }
        
        // Find duplicated titles
        const duplicatedTitles = Object.entries(titleCounts)
          .filter(([_, count]) => count > 1)
          .map(([title, count]) => ({ title, count }));
        
        if (duplicatedTitles.length > 0) {
          console.log(`Test Case: ${testCase.id}`);
          console.log(`Order ID: ${testCase.issueInfo.orderId}`);
          console.log('Duplicated Items:');
          
          for (const { title, count } of duplicatedTitles) {
            console.log(`  - "${title}" appears ${count} times`);
          }
          
          console.log('');
        }
      }
    }
  }
  
  // Analyze HTML patterns (simplified)
  console.log('\nHTML Pattern Analysis:');
  console.log('====================\n');
  
  // Just count occurrences of key selectors
  const selectors = [
    '.a-price-whole',
    '.a-offscreen',
    '.a-color-price',
    '[data-component="unitPrice"]',
    '.yohtmlc-item',
    '.item-price'
  ];
  
  const selectorCounts: Record<string, number> = {};
  
  for (const testCase of testCases) {
    if (testCase.html) {
      for (const selector of selectors) {
        // Very rough count - just string matches
        const count = (testCase.html.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        selectorCounts[selector] = (selectorCounts[selector] || 0) + count;
      }
    }
  }
  
  // Print selector counts
  for (const [selector, count] of Object.entries(selectorCounts)) {
    console.log(`${selector}: ${count} occurrences`);
  }
  
  console.log('\nTo run a specific test case, use:');
  console.log('npx jest -t "testCaseId"\n');
  
  console.log('For more detailed analysis, check the test case directories.');
}

// Run the script
analyzeTestCases().catch(error => {
  console.error('Error analyzing test cases:', error);
});