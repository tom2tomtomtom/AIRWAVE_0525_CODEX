import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withFlowRateLimit } from '@/lib/rate-limiter';
import { withCSRFProtection } from '@/lib/csrf';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import { processPDF } from '@/lib/pdf-processor';

// Configure to handle file uploads
export const config = {
  api: {
    bodyParser: false
  }
};

interface BriefData {
  title: string;
  objective: string;
  targetAudience: string;
  keyMessages: string[];
  platforms: string[];
  budget: string;
  timeline: string;
  product?: string;
  service?: string;
  valueProposition?: string;
  brandGuidelines?: string;
  requirements?: string[];
  industry?: string;
  competitors?: string[];
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Function to estimate token count (rough approximation: 1 token ≈ 4 characters)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Function to chunk large documents for processing
function chunkDocument(content: string, maxChunkSize: number = 6000): string[] {
  const estimatedTokens = estimateTokenCount(content);
  
  if (estimatedTokens <= maxChunkSize) {
    return [content];
  }
  
  console.log(`Document too large (${estimatedTokens} tokens), chunking into smaller parts...`);
  
  // Split by paragraphs first, then by sentences if needed
  const paragraphs = content.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
    
    if (estimateTokenCount(testChunk) <= maxChunkSize) {
      currentChunk = testChunk;
    } else {
      // If current chunk has content, save it
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If single paragraph is too large, split by sentences
      if (estimateTokenCount(paragraph) > maxChunkSize) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          const testSentenceChunk = sentenceChunk + (sentenceChunk ? ' ' : '') + sentence;
          
          if (estimateTokenCount(testSentenceChunk) <= maxChunkSize) {
            sentenceChunk = testSentenceChunk;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk);
              sentenceChunk = sentence;
            } else {
              // Even single sentence is too large, truncate
              chunks.push(sentence.substring(0, maxChunkSize * 4));
            }
          }
        }
        
        if (sentenceChunk) {
          currentChunk = sentenceChunk;
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  // Add the last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
    return chunks;
}

// Function to parse chunked documents by extracting info from each chunk and merging
async function parseChunkedDocument(chunks: string[], title: string): Promise<BriefData | null> {
    const chunkResults: Partial<BriefData>[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
        try {
      const chunkPrompt = `You are an expert marketing strategist. Analyze this section of a creative brief and extract any relevant information. This is part ${i + 1} of ${chunks.length} parts.

BRIEF SECTION:
${chunks[i]}

Extract any information you can find and return as JSON with these fields (use null for missing information):
{
  "title": "Brief title if mentioned",
  "objective": "Campaign objective/goal if mentioned", 
  "targetAudience": "Target audience description if mentioned",
  "keyMessages": ["array of key messages if found"],
  "platforms": ["array of platforms if mentioned"],
  "budget": "Budget information if mentioned",
  "timeline": "Timeline information if mentioned",
  "product": "Product/service name if mentioned",
  "service": "Service description if mentioned", 
  "valueProposition": "Value proposition if mentioned",
  "brandGuidelines": "Brand guidelines if mentioned",
  "requirements": ["array of requirements if found"],
  "industry": "Industry information if mentioned",
  "competitors": ["array of competitors if mentioned"]
}

Return only the JSON object.`;

      const response = await Promise.race([
        openai.chat.completions.create({
          model: 'gpt-4o-mini', // Use faster model for chunks
          messages: [
            {
              role: 'user',
              content: chunkPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1500
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI chunk request timeout')), 20000)
        )
      ]);

      const responseText = (response as any).choices[0]?.message?.content?.trim();
      if (responseText) {
        try {
          // Clean up potential markdown formatting from OpenAI
          let cleanedResponse = responseText;
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          }
          if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          
          const chunkData = JSON.parse(cleanedResponse);
          chunkResults.push(chunkData);
                  } catch (parseError: any) {
          console.warn(`Failed to parse chunk ${i + 1} response:`, parseError);
          console.warn(`Raw response was:`, responseText.substring(0, 200) + '...');
        }
      }
    } catch (error: any) {
      console.warn(`Error processing chunk ${i + 1}:`, error);
    }
  }
  
  // Merge results from all chunks
  if (chunkResults.length === 0) {
        return null;
  }
  
    return mergeChunkResults(chunkResults, title);
}

// Function to merge results from multiple chunks into a single BriefData object
function mergeChunkResults(chunkResults: Partial<BriefData>[], fallbackTitle: string): BriefData {
  const merged: BriefData = {
    title: fallbackTitle,
    objective: '',
    targetAudience: '',
    keyMessages: [],
    platforms: [],
    budget: 'TBD',
    timeline: 'TBD',
    product: '',
    service: '',
    valueProposition: '',
    brandGuidelines: '',
    requirements: [],
    industry: '',
    competitors: []
  };
  
  for (const chunk of chunkResults) {
    // Take the first non-null/non-empty value for string fields
    if (!merged.title && chunk.title) merged.title = chunk.title;
    if (!merged.objective && chunk.objective) merged.objective = chunk.objective;
    if (!merged.targetAudience && chunk.targetAudience) merged.targetAudience = chunk.targetAudience;
    if (!merged.product && chunk.product) merged.product = chunk.product;
    if (!merged.service && chunk.service) merged.service = chunk.service;
    if (!merged.valueProposition && chunk.valueProposition) merged.valueProposition = chunk.valueProposition;
    if (!merged.brandGuidelines && chunk.brandGuidelines) merged.brandGuidelines = chunk.brandGuidelines;
    if (!merged.industry && chunk.industry) merged.industry = chunk.industry;
    if (merged.budget === 'TBD' && chunk.budget) merged.budget = chunk.budget;
    if (merged.timeline === 'TBD' && chunk.timeline) merged.timeline = chunk.timeline;
    
    // Merge arrays, removing duplicates
    if (chunk.keyMessages && Array.isArray(chunk.keyMessages)) {
      chunk.keyMessages.forEach((msg: any) => {
        if (msg && !merged.keyMessages.includes(msg)) {
          merged.keyMessages.push(msg);
        }
      });
    }
    
    if (chunk.platforms && Array.isArray(chunk.platforms)) {
      chunk.platforms.forEach((platform: any) => {
        if (platform && !merged.platforms.includes(platform)) {
          merged.platforms.push(platform);
        }
      });
    }
    
    if (chunk.requirements && Array.isArray(chunk.requirements)) {
      chunk.requirements.forEach((req: any) => {
        if (req && !merged.requirements?.includes(req)) {
          merged.requirements?.push(req);
        }
      });
    }

    if (chunk.competitors && Array.isArray(chunk.competitors)) {
      chunk.competitors.forEach((comp: any) => {
        if (comp && !merged.competitors?.includes(comp)) {
          merged.competitors?.push(comp);
        }
      });
    }
  }
  
  // Ensure minimum defaults
  if (merged.keyMessages.length === 0) {
    merged.keyMessages = ['Key message extracted from brief analysis'];
  }
  if (merged.platforms.length === 0) {
    merged.platforms = ['Meta', 'Instagram', 'Facebook'];
  }
  
    return merged;
}

async function parseWithOpenAI(content: string, title: string): Promise<BriefData | null> {
  if (!process.env.OPENAI_API_KEY) {
        return null;
  }

    // Check if document needs chunking
  const chunks = chunkDocument(content, 6000); // Leave room for prompt and response

  if (chunks.length > 1) {
        return await parseChunkedDocument(chunks, title);
  }

  try {
    const prompt = `You are an expert marketing strategist tasked with extracting structured information from a creative brief. Please analyze the following creative brief and extract the key information into the specified JSON format.

CREATIVE BRIEF CONTENT:
${content}

Please extract and format the information as a JSON object with the following structure. Be specific and contextual to the brief content - avoid generic responses:
{
  "title": "Brief title or project name (extract from content or use filename)",
  "objective": "Main campaign objective and goals (be specific to this brief)",
  "targetAudience": "Detailed target audience description (extract specific demographics/psychographics)",
  "keyMessages": ["Key message 1", "Key message 2", "Key message 3"],
  "platforms": ["Platform1", "Platform2", "Platform3"],
  "budget": "Budget information if mentioned, otherwise 'Not specified'",
  "timeline": "Timeline or launch date information, otherwise 'Not specified'",
  "product": "Main product or service being promoted (be specific)",
  "service": "Service offerings or additional services",
  "valueProposition": "Unique value proposition or competitive advantage (extract from brief)",
  "brandGuidelines": "Brand guidelines, tone of voice, or creative mandatories",
  "requirements": ["Requirement 1", "Requirement 2"],
  "industry": "Industry or sector",
  "competitors": ["Competitor1", "Competitor2"]
}

IMPORTANT INSTRUCTIONS:
- Extract actual content from the brief, don't use placeholder text
- ALL FIELDS MUST BE STRINGS OR ARRAYS OF STRINGS - no nested objects
- For platforms, extract specific social media platforms mentioned (Facebook, Instagram, Meta, LinkedIn, etc.)
- For key messages, extract the actual messaging strategy and value propositions from the brief
- For target audience, combine all segments into a single comprehensive string description
- For value proposition, extract the main value prop and competitive advantages as a single string
- If budget or timeline says "TBD" or is not specified, use "TBD" or "Not specified"
- Be thorough but accurate - don't invent information not in the brief
- If a field has no relevant information, use an empty string or empty array as appropriate
- CRITICAL: Ensure targetAudience, valueProposition, and product are single strings, not objects

Respond ONLY with the JSON object, no additional text or explanation.`;

    const response = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI request timeout')), 30000)
      )
    ]);

    const responseText = (response as any).choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

        // Parse the JSON response
    const parsedData = JSON.parse(responseText);
    
    // Validate the parsed data has required fields
    if (!parsedData.title || !parsedData.objective) {
      throw new Error('Invalid response structure from OpenAI');
    }

    // Ensure arrays are properly formatted
    parsedData.keyMessages = Array.isArray(parsedData.keyMessages) ? parsedData.keyMessages : [];
    parsedData.platforms = Array.isArray(parsedData.platforms) ? parsedData.platforms : [];
    parsedData.requirements = Array.isArray(parsedData.requirements) ? parsedData.requirements : [];
    parsedData.competitors = Array.isArray(parsedData.competitors) ? parsedData.competitors : [];

    // Ensure string fields are properly converted
    if (typeof parsedData.targetAudience === 'object') {
      parsedData.targetAudience = JSON.stringify(parsedData.targetAudience);
    }
    if (typeof parsedData.valueProposition === 'object') {
      parsedData.valueProposition = JSON.stringify(parsedData.valueProposition);
    }
    if (typeof parsedData.product === 'object') {
      parsedData.product = JSON.stringify(parsedData.product);
    }

    // Ensure we have fallback values for key fields
    if (!parsedData.keyMessages || parsedData.keyMessages.length === 0) {
      parsedData.keyMessages = ['Key message from brief analysis'];
    }
    if (!parsedData.platforms || parsedData.platforms.length === 0) {
      parsedData.platforms = ['Meta', 'Instagram', 'Facebook'];
    }

    return parsedData as BriefData;

  } catch (error: any) {
    console.error('Error in OpenAI parsing:', error);
    return null;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get authenticated user from middleware
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
    try {
    // Parse the uploaded file
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      multiples: false
    });

        const [fields, files] = await form.parse(req);
    console.log('File upload parsing completed. Files:', Object.keys(files));
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

        // Read the file content based on file type
    let fileContent = '';
    const fileExtension = path.extname(uploadedFile.originalFilename || '').toLowerCase();
    
        try {
      if (fileExtension === '.txt' || fileExtension === '.md') {
        // Read text files directly
        fileContent = fs.readFileSync(uploadedFile.filepath, 'utf8');
              } else if (fileExtension === '.docx') {
        // Use mammoth to extract text from .docx files
                const buffer = fs.readFileSync(uploadedFile.filepath);
        const result = await mammoth.extractRawText({ buffer });
        fileContent = result.value;
        if (result.messages && result.messages.length > 0) {
                  }
              } else if (fileExtension === '.doc') {
        // .doc files are more complex, try mammoth but with fallback
                try {
          const buffer = fs.readFileSync(uploadedFile.filepath);
          const result = await mammoth.extractRawText({ buffer });
          fileContent = result.value;
                  } catch (docError: any) {
          console.warn('.doc parsing failed, this format may not be fully supported');
          fileContent = `Document: ${uploadedFile.originalFilename}\nNote: .doc format may require conversion to .docx for best results.`;
        }
        
      } else if (fileExtension === '.pdf') {
        // Use pdf-parse to extract text from PDF files
                const buffer = fs.readFileSync(uploadedFile.filepath);
        const pdfData = await processPDF(buffer, { extractText: true });
        fileContent = pdfData.text || '';
              } else {
        // Try to read as text for unknown formats
                fileContent = fs.readFileSync(uploadedFile.filepath, 'utf8');
              }
    } catch (error: any) {
      console.error('Error reading file:', error);
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
        // Extract basic information from filename and content
    const fileName = uploadedFile.originalFilename || 'Untitled Brief';
    const briefTitle = fileName.replace(/\.[^/.]+$/, '');

    // Parse content using AI/NLP (for now, we'll extract basic patterns)
    const parsedBrief = await parseDocumentContent(fileContent, briefTitle);

    // Debug logging to see what was parsed
    console.log('🔍 BRIEF PARSING - Extracted data:', {
      title: parsedBrief.title,
      objective: parsedBrief.objective?.substring(0, 100) + '...',
      targetAudience: parsedBrief.targetAudience?.substring(0, 100) + '...',
      keyMessages: parsedBrief.keyMessages,
      platforms: parsedBrief.platforms,
      product: parsedBrief.product,
      service: parsedBrief.service,
      valueProposition: parsedBrief.valueProposition?.substring(0, 100) + '...',
      industry: parsedBrief.industry,
      contentLength: fileContent.length
    });

    // Clean up uploaded file
    fs.unlinkSync(uploadedFile.filepath);

        return res.status(200).json({
      success: true,
      data: parsedBrief,
      message: 'Brief parsed successfully'
    });

  } catch (error: any) {
    console.error('Error parsing brief:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Generate error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.error(`Error ID: ${errorId}`);

    // Provide more specific error messages
    let errorMessage = 'Failed to parse brief';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('MultipartParser')) {
        errorMessage = 'File upload parsing failed - please try uploading the file again';
        statusCode = 400;
      } else if (error.message.includes('OpenAI')) {
        errorMessage = 'AI parsing failed - using fallback parsing method';
        statusCode = 503;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out - please try again with a smaller file';
        statusCode = 408;
      } else if (error.message.includes('Failed to read file')) {
        errorMessage = 'Unable to read the uploaded file - please check the file format';
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      errorId,
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : error) : undefined
    });
  }
}

async function parseDocumentContent(content: string, title: string): Promise<BriefData> {
  // First, try intelligent AI parsing with OpenAI
  try {
    const aiParsedData = await parseWithOpenAI(content, title);
    if (aiParsedData) {
            return aiParsedData;
    }
  } catch (error: any) {
    console.warn('OpenAI parsing failed, falling back to pattern matching:', error);
  }

  // Fallback to basic pattern matching
    const contentLower = content.toLowerCase();
  
  // Extract objective
  let objective = '';
  const objectivePatterns = [
    /objective[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /goal[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /purpose[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of objectivePatterns) {
    const match = content.match(pattern);
    if (match) {
      objective = match[1].trim();
      break;
    }
  }

  // Extract target audience
  let targetAudience = '';
  const audiencePatterns = [
    /target audience[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /audience[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /demographic[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of audiencePatterns) {
    const match = content.match(pattern);
    if (match) {
      targetAudience = match[1].trim();
      break;
    }
  }

  // Extract key messages
  const keyMessages: string[] = [];
  const messagePatterns = [
    /key messages?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /messages?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of messagePatterns) {
    const match = content.match(pattern);
    if (match) {
      const messages = match[1].split(/[,\n\-\•]/).map((m: any) => m.trim()).filter((m: any) => m.length > 0);
      keyMessages.push(...messages.slice(0, 5)); // Limit to 5 messages
      break;
    }
  }

  // Extract platforms
  const platforms: string[] = [];
  const platformKeywords = ['instagram', 'facebook', 'linkedin', 'twitter', 'youtube', 'tiktok', 'snapchat'];
  
  platformKeywords.forEach((platform: any) => {
    if (contentLower.includes(platform)) {
      platforms.push(platform.charAt(0).toUpperCase() + platform.slice(1));
    }
  });

  // Extract budget
  let budget = '';
  const budgetPattern = /budget[:\s]+[\$]?([0-9,]+)/i;
  const budgetMatch = content.match(budgetPattern);
  if (budgetMatch) {
    budget = `$${budgetMatch[1]}`;
  }

  // Extract timeline
  let timeline = '';
  const timelinePatterns = [
    /timeline[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /duration[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /(\d+)\s*(weeks?|months?|days?)/i
  ];
  
  for (const pattern of timelinePatterns) {
    const match = content.match(pattern);
    if (match) {
      timeline = match[1] ? match[1].trim() : match[0].trim();
      break;
    }
  }

  // Extract brand guidelines
  let brandGuidelines = '';
  const guidelinesPattern = /brand guidelines?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i;
  const guidelinesMatch = content.match(guidelinesPattern);
  if (guidelinesMatch) {
    brandGuidelines = guidelinesMatch[1].trim();
  }

  // Extract requirements
  const requirements: string[] = [];
  const requirementPatterns = [
    /requirements?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /deliverables?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of requirementPatterns) {
    const match = content.match(pattern);
    if (match) {
      const reqs = match[1].split(/[,\n\-\•]/).map((r: any) => r.trim()).filter((r: any) => r.length > 0);
      requirements.push(...reqs.slice(0, 10)); // Limit to 10 requirements
      break;
    }
  }

  // Extract product/service information
  let product = '';
  const productPatterns = [
    /product[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /service[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /offering[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /solution[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of productPatterns) {
    const match = content.match(pattern);
    if (match) {
      product = match[1].trim();
      break;
    }
  }

  // Extract service information
  let service = '';
  const servicePatterns = [
    /services?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /support[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /assistance[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of servicePatterns) {
    const match = content.match(pattern);
    if (match) {
      service = match[1].trim();
      break;
    }
  }

  // Extract value proposition
  let valueProposition = '';
  const valuePropositionPatterns = [
    /value proposition[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /unique selling point[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /usp[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /competitive advantage[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /differentiator[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of valuePropositionPatterns) {
    const match = content.match(pattern);
    if (match) {
      valueProposition = match[1].trim();
      break;
    }
  }

  // Extract industry
  let industry = '';
  const industryPatterns = [
    /industry[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /sector[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /market[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /vertical[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of industryPatterns) {
    const match = content.match(pattern);
    if (match) {
      industry = match[1].trim();
      break;
    }
  }

  // Extract competitors
  const competitors: string[] = [];
  const competitorPatterns = [
    /competitors?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /competition[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /rivals?[:\s]+(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];
  
  for (const pattern of competitorPatterns) {
    const match = content.match(pattern);
    if (match) {
      const comps = match[1].split(/[,\n\-\•]/).map((c: any) => c.trim()).filter((c: any) => c.length > 0);
      competitors.push(...comps.slice(0, 5)); // Limit to 5 competitors
      break;
    }
  }

  const result = {
    title,
    objective: objective || 'Strategic content creation to drive engagement and brand awareness',
    targetAudience: targetAudience || 'Target audience as defined in brief',
    keyMessages: keyMessages.length > 0 ? keyMessages : ['Key message from brief analysis'],
    platforms: platforms.length > 0 ? platforms : ['Instagram', 'LinkedIn', 'Facebook'],
    budget: budget || 'Budget as specified',
    timeline: timeline || 'Timeline as specified',
    product: product || '',
    service: service || '',
    valueProposition: valueProposition || '',
    industry: industry || '',
    competitors: competitors.length > 0 ? competitors : [],
    brandGuidelines,
    requirements
  };
  
  // Log completion for monitoring (production-safe)
  if (process.env.NODE_ENV === 'development') {
    console.log('Pattern matching completed. Extracted:', {
      title: result.title,
      objective: result.objective.substring(0, 50) + '...',
      keyMessageCount: result.keyMessages.length,
      platformCount: result.platforms.length
    });
  }
  
  return result;
}

// Apply authentication, rate limiting, and CSRF protection for security
export default withAuth(withFlowRateLimit(withCSRFProtection(handler)));