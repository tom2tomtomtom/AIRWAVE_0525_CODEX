export interface CreatomateTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  tags: string[];
  preview: string;
  thumbnail: string;
  description?: string;
  elements: CreatomateElement[];
}

export interface CreatomateElement {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'audio';
  source?: string;
  text?: string;
  modifiable: boolean;
}

export interface CreatomateRenderResponse {
  id: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  url?: string;
  thumbnail?: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export class CreatomateService {
  private apiKey: string;
  private baseUrl: string = 'https://api.creatomate.com/v1';
  private defaultTemplateId: string = '374ee9e3-de75-4feb-bfae-5c5e11d88d80';

  constructor() {
    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) {
      throw new Error('CREATOMATE_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  async getTemplate(templateId?: string): Promise<CreatomateTemplate> {
    const id = templateId || this.defaultTemplateId;

    try {
      const response = await fetch(`${this.baseUrl}/templates/${id}`, {
        headers: {},
        'Authorization': `Bearer ${this.apiKey
      }`,
          'Content-Type': 'application/json'}});

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.mapCreatomateTemplate(data);
    } catch (error: any) {
      console.error(`Error fetching template ${id}:`, error);
      return this.getDefaultTemplate();
    }
  }

  async getTemplates(limit: number = 20): Promise<CreatomateTemplate[]> {
    try {
      const response = await fetch(`${this.baseUrl}/templates?limit=${limit}`, {
        headers: {},
        'Authorization': `Bearer ${this.apiKey
      }`,
          'Content-Type': 'application/json'}});

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle both array response and paginated response
      const templates = Array.isArray(data) ? data : (data.data || []);

      return templates.map((template: any) => this.mapCreatomateTemplate(template));
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      // Return default template as fallback
      return [this.getDefaultTemplate()];
    }
  }

  async renderVideo(modifications: Record<string, any>, templateId?: string): Promise<CreatomateRenderResponse> {
    const id = templateId || this.defaultTemplateId;
    
    try {
      const response = await fetch(`${this.baseUrl}/renders`, {
        method: 'POST',
        headers: {},
        'Authorization': `Bearer ${this.apiKey
      }`,
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          template_id: id,
          modifications,
          output_format: 'mp4'})});

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        id: data.id,
        status: data.status,
        url: data.url,
        thumbnail: data.thumbnail,
        created_at: data.created_at,
        completed_at: data.completed_at,
        error: data.error};
    } catch (error: any) {
      console.error('Error rendering video:', error);
      throw new Error(`Failed to render video: ${error}`);
    }
  }

  async getRenderStatus(renderId: string): Promise<CreatomateRenderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/renders/${renderId}`, {
        headers: {},
        'Authorization': `Bearer ${this.apiKey
      }`,
          'Content-Type': 'application/json'}});

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        id: data.id,
        status: data.status,
        url: data.url,
        thumbnail: data.thumbnail,
        created_at: data.created_at,
        completed_at: data.completed_at,
        error: data.error};
    } catch (error: any) {
      console.error(`Error getting render status ${renderId}:`, error);
      throw new Error('Failed to get render status');
    }
  }

  private getDefaultTemplate(): CreatomateTemplate {
    return {
      id: this.defaultTemplateId,
      name: 'Social Media Automation Template',
      width: 1080,
      height: 1920,
      duration: 15,
      frameRate: 30,
      tags: ['social', 'automation'],
      preview: 'https://via.placeholder.com/1080x1920/4f46e5/ffffff?text=Template',
      thumbnail: 'https://via.placeholder.com/300x533/4f46e5/ffffff?text=Template',
      description: 'Professional social media video template',
      elements: [
        {
          id: 'Music',
          name: 'Background Music',
          type: 'audio',
          source: 'https://creatomate.com/files/assets/b5dc815e-dcc9-4c62-9405-f94913936bf5',
          modifiable: true }
        {
          id: 'Text-1',
          name: 'Main Text',
          type: 'text',
          text: 'Welcome to AIrWAVE! 🚀',
          modifiable: true }
      ]};
  }

  private mapCreatomateTemplate(data: any): CreatomateTemplate {
    return {
      id: data.id,
      name: data.name || 'Untitled Template',
      width: data.width || 1080,
      height: data.height || 1920,
      duration: data.duration || 15,
      frameRate: data.frame_rate || 30,
      tags: data.tags || [],
      preview: data.preview || data.thumbnail || '',
      thumbnail: data.thumbnail || '',
      description: data.description || '',
      elements: (data.elements || []).map((element: any) => ({
        id: element.id || element.name,
        name: element.name || element.id,
        type: this.getElementType(element),
        source: element.source,
        text: element.text,
        modifiable: element.modifiable !== false}))};
  }

  private getElementType(element: any): 'text' | 'image' | 'video' | 'audio' {
    if (element.type) return element.type;
    if (element.text !== undefined) return 'text';
    if (element.source) {
      const source = element.source.toLowerCase();
      if (source.includes('audio') || source.includes('music')) return 'audio';
      if (source.includes('video') || source.includes('.mp4')) return 'video';
      return 'image';
    }
    return 'text';
  }
}

export const creatomateService = new CreatomateService();
