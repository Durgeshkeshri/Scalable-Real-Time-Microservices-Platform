/**
 * Task Processor - Handles different types of background tasks
 * Supports: email, report, dataProcessing, imageProcessing
 */

// Simulate email sending
const processEmailTask = async (jobData) => {
    const { data } = jobData;
    
    console.log(`📧 Sending email to: ${data.recipient || 'user@example.com'}`);
    console.log(`   Subject: ${data.subject || 'Notification'}`);
    
    // Simulate email sending delay
    await delay(randomDelay(500, 1500));
    
    return {
      status: 'sent',
      recipient: data.recipient || 'user@example.com',
      subject: data.subject || 'Notification',
      sentAt: new Date().toISOString(),
      messageId: generateId()
    };
  };
  
  // Simulate report generation
  const processReportTask = async (jobData) => {
    const { data } = jobData;
    
    console.log(`📊 Generating report: ${data.reportType || 'general'}`);
    console.log(`   Format: ${data.format || 'PDF'}`);
    
    // Simulate report generation (more intensive)
    await delay(randomDelay(2000, 4000));
    
    // Simulate progress updates
    for (let i = 20; i <= 80; i += 20) {
      await jobData.updateProgress(i);
      await delay(500);
    }
    
    return {
      status: 'generated',
      reportType: data.reportType || 'general',
      format: data.format || 'PDF',
      fileSize: Math.floor(Math.random() * 5000) + 1000, // KB
      downloadUrl: `https://reports.example.com/${generateId()}.pdf`,
      generatedAt: new Date().toISOString(),
      reportId: generateId()
    };
  };
  
  // Simulate data processing
  const processDataProcessingTask = async (jobData) => {
    const { data } = jobData;
    
    console.log(`⚙️  Processing data batch: ${data.batchId || 'unknown'}`);
    console.log(`   Records: ${data.recordCount || 100}`);
    
    const recordCount = data.recordCount || 100;
    
    // Simulate processing records
    for (let i = 0; i < recordCount; i += 10) {
      await delay(100);
      const progress = Math.min(Math.floor((i / recordCount) * 80) + 10, 90);
      await jobData.updateProgress(progress);
    }
    
    return {
      status: 'processed',
      batchId: data.batchId || generateId(),
      recordsProcessed: recordCount,
      recordsFailed: Math.floor(Math.random() * 5),
      processingTime: recordCount * 10, // ms
      processedAt: new Date().toISOString()
    };
  };
  
  // Simulate image processing
  const processImageProcessingTask = async (jobData) => {
    const { data } = jobData;
    
    console.log(`🖼️  Processing image: ${data.imageUrl || 'image.jpg'}`);
    console.log(`   Operations: ${data.operations?.join(', ') || 'resize, compress'}`);
    
    // Simulate image processing operations
    const operations = data.operations || ['resize', 'compress', 'watermark'];
    
    for (let i = 0; i < operations.length; i++) {
      console.log(`   • Applying ${operations[i]}...`);
      await delay(randomDelay(800, 1500));
      const progress = Math.floor(((i + 1) / operations.length) * 80) + 10;
      await jobData.updateProgress(progress);
    }
    
    return {
      status: 'processed',
      originalImage: data.imageUrl || 'image.jpg',
      processedImage: `https://cdn.example.com/processed/${generateId()}.jpg`,
      operations: operations,
      dimensions: {
        width: data.targetWidth || 1920,
        height: data.targetHeight || 1080
      },
      fileSize: Math.floor(Math.random() * 2000) + 500, // KB
      processedAt: new Date().toISOString(),
      imageId: generateId()
    };
  };
  
  // Main task processor
  const processTask = async (job) => {
    const { name, data } = job;
    
    console.log(`\n🔧 Processing task type: ${name}`);
    console.log(`   Job ID: ${job.id}`);
    console.log(`   User ID: ${data.userId}`);
    console.log(`   Data:`, JSON.stringify(data.data, null, 2));
    
    try {
      let result;
      
      switch (name) {
        case 'email':
          result = await processEmailTask(job);
          break;
          
        case 'report':
          result = await processReportTask(job);
          break;
          
        case 'dataProcessing':
          result = await processDataProcessingTask(job);
          break;
          
        case 'imageProcessing':
          result = await processImageProcessingTask(job);
          break;
          
        default:
          console.log(`⚡ Processing generic task: ${name}`);
          await delay(randomDelay(1000, 2000));
          result = {
            status: 'completed',
            taskType: name,
            message: `Task ${name} completed successfully`,
            processedAt: new Date().toISOString()
          };
      }
      
      return {
        ...result,
        jobId: job.id,
        taskType: name,
        processingStarted: new Date(job.processedOn || Date.now()).toISOString(),
        processingCompleted: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error processing task ${name}:`, error);
      throw new Error(`Task processing failed: ${error.message}`);
    }
  };
  
  // Utility functions
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const randomDelay = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };
  
  module.exports = {
    processTask
  };
  