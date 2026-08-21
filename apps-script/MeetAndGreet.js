/**
 * Post Receiver for Waffle House Boarding Database
 * Handles creation, updating, and deletion of Meet & Greet bookings.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form Responses 1"); 
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "Target sheet tab 'Form Responses 1' not found." 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var action = data.action || "create";
    var rows = sheet.getDataRange().getValues();
    
    // ==========================================
    // ACTION 1: CREATE A NEW MEET & GREET
    // ==========================================
    if (action === "create") {
      sheet.appendRow([
        new Date(),          // Column A: Timestamp
        data.dogName,        // Column B: Dog Name
        data.breed,          // Column C: Breed
        data.startDate,      // Column D: Start Date (YYYY-MM-DD string)
        data.endDate,        // Column E: End Date (YYYY-MM-DD string)
        "",                  // Column F: Owner Name (Blank)
        "",                  // Column G: Contact Phone (Blank)
        "",                  // Column H: Likes (Blank)
        "",                  // Column I: Dislikes (Blank)
        data.notes,          // Column J: Booking Notes
        "",                  // Column K: Edit Link (Blank)
        "Meet & Greet"       // Column L: Type / Status Flag!
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "create" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================
    // ACTION 2: EDIT OR DELETE AN EXISTING ENTRY
    // ==========================================
    var targetRowIndex = -1;
    
    // Extract a clean YYYY-MM-DD match target from the web app payload
    var targetDateStr = String(data.originalStartDate || data.startDate).split('T')[0].trim(); 
    var targetDogName = String(data.originalDogName || data.dogName).trim().toLowerCase();

    for (var i = 1; i < rows.length; i++) {
      var sheetDogName = String(rows[i][1]).trim().toLowerCase();
      var sheetStartDate = rows[i][3];
      var sheetType = String(rows[i][11]).trim();
      
      // Only process entries explicitly flagged as a Meet & Greet
      if (sheetType.toLowerCase() !== "meet & greet") continue;

      // Extract a matching YYYY-MM-DD string safely from the spreadsheet cell
      var formattedSheetDate = "";
      if (sheetStartDate instanceof Date) {
        var y = sheetStartDate.getFullYear();
        var m = String(sheetStartDate.getMonth() + 1).padStart(2, '0');
        var d = String(sheetStartDate.getDate()).padStart(2, '0');
        formattedSheetDate = y + "-" + m + "-" + d;
      } else if (sheetStartDate) {
        formattedSheetDate = String(sheetStartDate).split('T')[0].trim();
        if (formattedSheetDate.includes('/')) {
          var parts = formattedSheetDate.split('/');
          if (parts.length === 3) {
            formattedSheetDate = parts[2] + "-" + parts[1].padStart(2, '0') + "-" + parts[0].padStart(2, '0');
          }
        }
      }
      
      // Perform cross-comparison validation
      if (sheetDogName === targetDogName && formattedSheetDate === targetDateStr) {
        targetRowIndex = i + 1; // Map array index to exact spreadsheet row number
        break;
      }
    }
    
    // Safety fallback if row is nowhere to be found
    if (targetRowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "Could not find matching row entry for " + targetDogName + " on " + targetDateStr
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Execute database deletion
    if (action === "delete") {
      sheet.deleteRow(targetRowIndex);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "delete" }))
                           .setMimeType(ContentService.MimeType.JSON);
    } 
    
    // Execute database modification updates
    if (action === "update") {
      sheet.getRange(targetRowIndex, 2).setValue(data.dogName);  // Column B: Name
      sheet.getRange(targetRowIndex, 3).setValue(data.breed);    // Column C: Breed
      sheet.getRange(targetRowIndex, 10).setValue(data.notes);   // Column J: Notes
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "update" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
                         
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}