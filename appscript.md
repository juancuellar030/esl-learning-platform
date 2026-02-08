/**
 * Handles GET requests - required for CORS preflight and connection testing
 */
function doGet(e) {
  return createJsonResponse({ 
    success: true, 
    message: 'Student Behavior Tracker API is running',
    timestamp: new Date().toISOString()
  });
}

/**
 * Handles POST requests from the Student Behavior Tracker web app.
 * This is the main entry point for the web app.
 */
function doPost(e) {
  // Use a lock to prevent simultaneous writes from multiple users, which can corrupt data.
  const lock = LockService.getScriptLock();
  lock.tryLock(15000); // Wait up to 15 seconds for the lock.

  try {
    // The incoming data is a string, so we must parse it into a JavaScript object.
    const requestData = JSON.parse(e.postData.contents);

    // Route the request based on the 'action' property in the data.
    if (requestData.action === 'save') {
      return saveData(requestData);
    }

    if (requestData.action === 'load') {
      return loadData(requestData);
    }

    // If the action is unknown, return an error.
    return createJsonResponse({ success: false, error: 'Unknown action specified.' });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Save behavior data to Google Sheets
 */
function saveData(requestData) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getOrCreateWeekSheet(requestData.week);
    
    // Set up headers if this is a new sheet
    setupSheetHeaders(sheet);
    
    // Apply conditional formatting to the new sheet
    applyConditionalFormatting(sheet);
    
    // Save the data
    saveBehaviorData(sheet, requestData.behaviorData, requestData.weekCompleted);
    
    return createJsonResponse({
      success: true,
      message: 'Data saved successfully',
      studentsUpdated: Object.keys(requestData.behaviorData).length
    });
    
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Load behavior data from Google Sheets
 */
function loadData(requestData) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(requestData.week);
    
    if (!sheet) {
      return createJsonResponse({ 
        success: false, 
        error: 'No data found for week: ' + requestData.week 
      });
    }
    
    const behaviorData = loadBehaviorData(sheet);
    
    return createJsonResponse({
      success: true,
      week: requestData.week,
      behaviorData: behaviorData,
      studentsLoaded: Object.keys(behaviorData).length
    });
    
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Get existing sheet or create new one for the week
 */
function getOrCreateWeekSheet(weekName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(weekName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(weekName);
    console.log('Created new sheet:', weekName);
  }
  
  return sheet;
}

/**
 * Set up headers for the behavior tracking sheet
 */
function setupSheetHeaders(sheet) {
  // Check if headers already exist
  if (sheet.getRange(1, 1).getValue() === 'Student Name') {
    return; // Headers already set up
  }
  
  const headers = [
    'Student Name',
    'monday1', 'monday2', 'monday3', 'monday4', 'monday5',
    'wednesday1', 'wednesday2', 'wednesday3', 'wednesday4', 'wednesday5',
    'thursday1', 'thursday2', 'thursday3', 'thursday4', 'thursday5', 'thursday6', 'thursday7'
  ];
  
  // Set headers in first row
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#333333ff')
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Set column widths
  // Column A (Student Name) - wider for names
  sheet.setColumnWidth(1, 180);
  
  // Columns B-S (weekday periods) - narrow for marks
  for (let col = 2; col <= headers.length; col++) {
    sheet.setColumnWidth(col, 60);
  }
  
  console.log('Headers set up for sheet:', sheet.getName());
}

/**
 * Apply conditional formatting to highlight rows with 3+ X marks in red
 */
function applyConditionalFormatting(sheet) {
  try {
    // Clear existing conditional formatting
    sheet.clearConditionalFormatRules();
    
    // Get the data range (assuming max 100 students, adjust as needed)
    const dataRange = sheet.getRange(2, 1, 100, 18); // Start from row 2, cover all columns
    
    // Create conditional formatting rule for 3+ X marks
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .setRanges([dataRange])
      .whenFormulaSatisfied('=COUNTIF($B2:$S2,"X")>=3') // Count X marks from columns B to S
      .setBackground('#ffcccc') // Light red background
      .setBold(true)
      .build();
    
    // Apply the rule
    sheet.setConditionalFormatRules([rule]);
    
    console.log('Conditional formatting applied to sheet:', sheet.getName());
    
  } catch (error) {
    console.error('Error applying conditional formatting:', error);
    // Don't throw error - formatting is nice-to-have, not critical
  }
}

/**
 * Save behavior data to the sheet
 */
function saveBehaviorData(sheet, behaviorData, weekCompleted) {
  const students = [
    'ALEJANDRA H.', 'ALEJANDRO C.', 'ANAMARIA C.', 'ANTONELLA P.', 'BRIANA C.',
    'DANIEL P.', 'DANNA P.', 'EMILIANO Q.', 'EMILIANO T.', 'EMILIO R.',
    'ERMES V.', 'EVA MARIA P.', 'JUAN J. RÍOS', 'JUAN J. SARRIAS', 'KESHIA C.',
    'LAURA S.', 'LAURA BERNAL', 'LORENZO R.', 'LUCIANO M.', 'MATIAS F.',
    'MIA H.', 'PABLO A.', 'PAULA V.', 'SAMANTHA C', 'SAMUEL G.',
    'SANTIGO O.', 'SARA LUCÍA V.', 'THOMAS C.', 'VALERIA P.'
  ];
  
  const periods = [
    'monday1', 'monday2', 'monday3', 'monday4', 'monday5',
    'wednesday1', 'wednesday2', 'wednesday3', 'wednesday4', 'wednesday5',
    'thursday1', 'thursday2', 'thursday3', 'thursday4', 'thursday5', 'thursday6', 'thursday7'
  ];
  
  // Prepare data array
  const dataToWrite = [];
  
  students.forEach((student, index) => {
    const row = [student]; // Start with student name
    
    // Add behavior data for each period
    periods.forEach(period => {
      const value = behaviorData[student] && behaviorData[student][period] ? behaviorData[student][period] : '';
      row.push(value);
    });
    
    dataToWrite.push(row);
  });
  
  // Write data starting from row 2
  if (dataToWrite.length > 0) {
    sheet.getRange(2, 1, dataToWrite.length, dataToWrite[0].length).setValues(dataToWrite);
  }
  
  // Add week completion status in a separate cell (optional)
  if (weekCompleted) {
    sheet.getRange(1, 19).setValue('COMPLETED').setBackground('#90EE90');
  }
  
  console.log('Behavior data saved for', students.length, 'students');
}

/**
 * Load behavior data from the sheet
 */
function loadBehaviorData(sheet) {
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return {}; // No data rows
  }
  
  const headers = data[0]; // First row is headers
  const behaviorData = {};
  
  // Process each data row (starting from row 2)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const studentName = row[0];
    
    if (!studentName) continue; // Skip empty rows
    
    behaviorData[studentName] = {};
    
    // Map each column to its corresponding period
    const periods = [
      'monday1', 'monday2', 'monday3', 'monday4', 'monday5',
      'wednesday1', 'wednesday2', 'wednesday3', 'wednesday4', 'wednesday5',
      'thursday1', 'thursday2', 'thursday3', 'thursday4', 'thursday5', 'thursday6', 'thursday7'
    ];
    
    periods.forEach((period, index) => {
      const columnIndex = index + 1; // +1 because first column is student name
      behaviorData[studentName][period] = row[columnIndex] || '';
    });
  }
  
  return behaviorData;
}

/**
 * Create a standardized JSON response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function to manually apply formatting to existing sheets
 * Run this once to format all existing sheets in your spreadsheet
 */
function formatAllExistingSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  
  sheets.forEach(sheet => {
    // Skip if it's the default "Sheet1" or other non-week sheets
    if (sheet.getName().includes('Sheet') || sheet.getName().includes('TEMPLATE')) {
      return;
    }
    
    console.log('Applying formatting to:', sheet.getName());
    setupSheetHeaders(sheet);
    applyConditionalFormatting(sheet);
  });
  
  console.log('Formatting applied to all existing sheets');
}

/**
 * Test function - you can run this to test the conditional formatting
 */
function testConditionalFormatting() {
  const sheet = SpreadsheetApp.getActiveSheet();
  applyConditionalFormatting(sheet);
  console.log('Test formatting applied to current sheet');
}