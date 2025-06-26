/**
 * PDF Processing Library with Dynamic Loading
 * Lazy-loads PDF processing libraries only when needed to reduce bundle size
 */

// Types for the PDF processing libraries
interface PDFData {
  text: string;
  numpages: number;
  info?: any;
  metadata?: any;
}

interface PDFJSExtract {
  extract: (buffer: Buffer, options?: any) => Promise<any>;
}

/**
 * Dynamically imports pdf-parse library only when needed
 * This reduces the main bundle size by ~33MB
 */
async function loadPDFParse() {
  const pdfParse = await import('pdf-parse');
  return pdfParse.default || pdfParse;
}

/**
 * Dynamically imports pdf.js-extract library only when needed
 */
async function loadPDFJSExtract(): Promise<PDFJSExtract> {
  const pdfExtract = await import('pdf.js-extract');
  return pdfExtract.default || pdfExtract;
}

/**
 * Parse PDF content from buffer using pdf-parse (fast, text-focused)
 */
export async function parsePDFContent(buffer: Buffer): Promise<PDFData> {
  try {
    const pdfParse = await loadPDFParse();
    const data = await pdfParse(buffer);
    
    return {
      text: data.text || '',
      numpages: data.numpages || 0,
      info: data.info,
      metadata: data.metadata
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF document');
  }
}

/**
 * Extract structured PDF data using pdf.js-extract (slower, more detailed)
 */
export async function extractPDFStructure(buffer: Buffer) {
  try {
    const pdfExtract = await loadPDFJSExtract();
    const data = await pdfExtract.extract(buffer, {});
    
    return data;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract PDF structure');
  }
}

/**
 * Smart PDF processor that chooses the best method based on requirements
 */
export async function processPDF(buffer: Buffer, options: {
  extractText?: boolean;
  extractStructure?: boolean;
  extractImages?: boolean;
} = { extractText: true }) {
  const results: any = {};
  
  // Use faster pdf-parse for simple text extraction
  if (options.extractText) {
    const textData = await parsePDFContent(buffer);
    results.text = textData.text;
    results.pages = textData.numpages;
    results.info = textData.info;
  }
  
  // Use pdf.js-extract for detailed structure extraction
  if (options.extractStructure || options.extractImages) {
    const structureData = await extractPDFStructure(buffer);
    results.structure = structureData;
  }
  
  return results;
}

/**
 * Utility to check if a buffer contains a valid PDF
 */
export function isPDFBuffer(buffer: Buffer): boolean {
  // PDF files start with %PDF- followed by version
  const pdfHeader = buffer.subarray(0, 5).toString();
  return pdfHeader === '%PDF-';
}

/**
 * Get PDF metadata without parsing full content (lightweight check)
 */
export async function getPDFMetadata(buffer: Buffer) {
  if (!isPDFBuffer(buffer)) {
    throw new Error('Invalid PDF file');
  }
  
  try {
    const pdfParse = await loadPDFParse();
    const data = await pdfParse(buffer, { 
      // Only extract metadata, not full text content
      version: 'v1.10.100',
      max: 0 // Don't extract pages
    });
    
    return {
      pages: data.numpages,
      info: data.info,
      metadata: data.metadata,
      size: buffer.length
    };
  } catch (error) {
    console.error('PDF metadata extraction error:', error);
    throw new Error('Failed to extract PDF metadata');
  }
}