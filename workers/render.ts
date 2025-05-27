// workers/render.ts
import { Worker, Job } from 'bullmq';
import { connection } from '@/lib/queue/connection';
import { supabase } from '@/lib/supabase';

interface RenderJobData {
  executionId: string;
  templateId: string;
  modifications: Record<string, any>;
  quality: 'preview' | 'final';
}

export const renderWorker = new Worker<RenderJobData>(
  'render',
  async (job: Job<RenderJobData>) => {
    const { executionId, templateId, modifications, quality } = job.data;
    
    try {
      // Update job progress
      await job.updateProgress(10);
      
      // Call Creatomate API
      const response = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_id: templateId,
          modifications,
          quality: quality === 'preview' ? 'low' : 'high'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Creatomate API error: ${response.statusText}`);
      }
      
      const renderData = await response.json();
      await job.updateProgress(50);
      
      // Poll for completion
      let render = renderData;
      while (render.status === 'pending' || render.status === 'rendering') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(
          `https://api.creatomate.com/v1/renders/${render.id}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`
            }
          }
        );
        
        render = await statusResponse.json();
        await job.updateProgress(50 + (render.progress || 0) * 0.4);
      }
      
      if (render.status === 'succeeded') {
        // Update execution with output URL
        await supabase
          .from('executions')
          .update({
            status: 'completed',
            output_url: render.output_url,
            metadata: { render_id: render.id }
          })
          .eq('id', executionId);
          
        await job.updateProgress(100);
        return { success: true, output_url: render.output_url };
      } else {
        throw new Error(`Render failed: ${render.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      // Update execution as failed
      await supabase
        .from('executions')
        .update({
          status: 'failed',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
        .eq('id', executionId);
        
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  }
);