// src/pages/api/ai/cost-check.ts
// Pre-flight cost checking endpoint for AI operations

import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/withAuth';
import { withCSRFProtection } from '@/lib/csrf';
import { ProductionAICostController } from '@/lib/ai/production-cost-controller';

// import { loggers } from '@/lib/logger'; // Unused
import {
  estimateTokensForMotivations,
  estimateTokensForCopy,
  estimateTokensForImageGeneration,
  estimateTokensForBriefParsing,
  getRecommendedModel,
} from '@/utils/ai-cost-estimation';

const aiCostController = ProductionAICostController.getInstance();

interface CostCheckRequest {
  service: 'openai' | 'anthropic' | 'elevenlabs';
  model: string;
  estimatedTokens?: number;
  operation: 'generate-motivations' | 'generate-copy' | 'generate-image' | 'parse-brief';
  operationData?: any; // Brief data, motivations, etc.
}

interface CostCheckResponse {
  allowed: boolean;
  reason?: string;
  fallbackModel?: string;
  currentUsage: number;
  budgetRemaining: number;
  estimatedCost: number;
  recommendation?: {
    model: string;
    cost: number;
    reason: string;
  };
  usageStats?: {
    dailyRate: number;
    projectedMonthly: number;
    percentOfBudget: number;
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse<CostCheckResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      allowed: false,
      reason: 'Method not allowed',
      currentUsage: 0,
      budgetRemaining: 0,
      estimatedCost: 0,
    });
  }

  const user = (req as any).user;
  const { service, model, estimatedTokens, operation, operationData }: CostCheckRequest = req.body;

  if (!service || !model || !operation) {
    return res.status(400).json({
      allowed: false,
      reason: 'Missing required fields: service, model, operation',
      currentUsage: 0,
      budgetRemaining: 0,
      estimatedCost: 0,
    });
  }

  try {
    // Calculate estimated tokens based on operation type
    let tokens = estimatedTokens;

    if (!tokens) {
      switch (operation) {
        case 'generate-motivations':
          tokens = estimateTokensForMotivations(operationData);
          break;
        case 'generate-copy':
          tokens = estimateTokensForCopy(
            operationData.motivations,
            operationData.briefData,
            operationData.platforms
          );
          break;
        case 'generate-image':
          tokens = estimateTokensForImageGeneration(
            operationData.briefData,
            operationData.motivations,
            operationData.imageCount || 1
          );
          break;
        case 'parse-brief':
          tokens = estimateTokensForBriefParsing(operationData.fileSize);
          break;
        default:
          tokens = 1000; // Default fallback
      }
    }

    // Check budget with cost controller
    const budgetCheck = await aiCostController.checkBudget(service, model, tokens, user.id);

    // Get current usage stats
    const monthlyUsage = await aiCostController.getMonthlyUsage(service, user.id);
    const fullReport = await aiCostController.getFullReport(user.id);

    // Calculate usage statistics
    const daysElapsed = new Date().getDate();
    const dailyRate = monthlyUsage.totalCost / daysElapsed;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const projectedMonthly = dailyRate * daysInMonth;
    const serviceConfig = (fullReport as any).services[service];
    const percentOfBudget = (monthlyUsage.totalCost / serviceConfig.budget) * 100;

    // Get model recommendation if budget is tight
    let recommendation;
    if (!budgetCheck.allowed || budgetCheck.fallbackModel) {
      recommendation = getRecommendedModel(
        service as 'openai' | 'anthropic',
        tokens,
        budgetCheck.budgetRemaining || 0,
        model
      );
    }

    const response: CostCheckResponse = {
      allowed: budgetCheck.allowed,
      ...(budgetCheck.reason && { reason: budgetCheck.reason }),
      ...(budgetCheck.fallbackModel && { fallbackModel: budgetCheck.fallbackModel }),
      currentUsage: budgetCheck.currentUsage || 0,
      budgetRemaining: budgetCheck.budgetRemaining || 0,
      estimatedCost: recommendation?.cost || 0,
      ...(recommendation && { recommendation }),
      usageStats: {
        dailyRate,
        projectedMonthly,
        percentOfBudget,
      },
    };

    // Log the cost check for audit purposes
    console.log(`💰 Cost Check: ${service}/${model} - ${operation}`, {
      user: user.id,
      tokens,
      allowed: budgetCheck.allowed,
      currentUsage: budgetCheck.currentUsage,
      budgetRemaining: budgetCheck.budgetRemaining,
    });

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Cost check error:', error);

    return res.status(500).json({
      allowed: false,
      reason: 'Internal error during cost check',
      currentUsage: 0,
      budgetRemaining: 0,
      estimatedCost: 0,
    });
  }
}

export default withAuth(withCSRFProtection(handler));
