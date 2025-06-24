import { getLogger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { RenderedCampaign } from './campaignRenderer';
import { PopulatedTemplate } from './templateEngine';

const logger = getLogger('review-system');

export interface ReviewWorkflow {
  id: string;
  campaignId: string;
  briefId: string;
  name: string;
  description: string;
  stages: ReviewStage[];
  currentStage: number;
  status: 'pending' | 'in-review' | 'approved' | 'rejected' | 'revision-requested' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata: {},
        totalStages: number;
    completedStages: number;
    averageReviewTime: number;
    escalations: number;
    revisionRounds: number;
  
      };
}

export interface ReviewStage {
  id: string;
  name: string;
  description: string;
  type: 'content' | 'creative' | 'legal' | 'brand' | 'technical' | 'final';
  reviewers: Reviewer[];
  requirements: StageRequirement[];
  status: 'pending' | 'in-progress' | 'approved' | 'rejected' | 'skipped';
  approvalThreshold: 'any' | 'majority' | 'all';
  timeLimit?: number; // hours
  order: number;
  isOptional: boolean;
  autoApprove?: boolean;
  escalationRules?: EscalationRule[];
}

export interface Reviewer {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'reviewer' | 'approver' | 'stakeholder' | 'observer';
  expertise: string[];
  permissions: ReviewerPermissions;
  status: 'assigned' | 'reviewing' | 'completed' | 'unavailable';
  assignedAt: Date;
  responseTime?: number; // hours
}

export interface ReviewerPermissions {
  canApprove: boolean;
  canReject: boolean;
  canRequestRevisions: boolean;
  canAddComments: boolean;
  canViewAll: boolean;
  canReassign: boolean;
}

export interface StageRequirement {
  id: string;
  type: 'approval' | 'checklist' | 'document' | 'signature' | 'comment';
  name: string;
  description: string;
  isRequired: boolean;
  completedBy?: string;
  completedAt?: Date;
  evidence?: string[]; // URLs or file references
}

export interface EscalationRule {
  id: string;
  condition: 'time_exceeded' | 'rejection' | 'no_response' | 'conflict';
  threshold: number; // hours for time_exceeded
  action: 'notify' | 'reassign' | 'auto_approve' | 'escalate_to_manager';
  escalateTo?: string[]; // user IDs
}

export interface ReviewSubmission {
  id: string;
  workflowId: string;
  stageId: string;
  reviewerId: string;
  decision: 'approve' | 'reject' | 'request_revision' | 'defer';
  comments: ReviewComment[];
  attachments: string[];
  submittedAt: Date;
  timeSpent: number; // minutes
  nextStageRecommendation?: string;
}

export interface ReviewComment {
  id: string;
  type: 'general' | 'element' | 'suggestion' | 'issue' | 'praise';
  severity: 'info' | 'minor' | 'major' | 'critical';
  content: string;
  elementId?: string; // Reference to campaign element
  position?: { x: number; y: number }; // Coordinate-based comment
  category: string; // e.g., 'typography', 'color', 'content', 'layout'
  status: 'open' | 'addressed' | 'resolved' | 'dismissed';
  createdBy: string;
  createdAt: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  tags: string[];
}

export interface ReviewAnalytics {
  workflowId: string;
  performance: {},
  totalTime: number;
    averageStageTime: number;
    bottlenecks: Array<{
      stageId: string;
      stageName: string;
      averageTime: number;
      delayReasons: string[];
    }>;
    efficiency: number; // 0-100 score
  };
  participation: {},
  totalReviewers: number;
    activeReviewers: number;
    averageResponseTime: number;
    topPerformers: Array<{
      reviewerId: string;
      name: string;
      responseTime: number;
      qualityScore: number;
    }>;
  };
  quality: {},
  totalComments: number;
    issuesFound: number;
    issuesResolved: number;
    revisionRounds: number;
    finalApprovalScore: number;
  };
}

export interface ReviewNotification {
  id: string;
  type: 'assignment' | 'reminder' | 'escalation' | 'approval' | 'rejection' | 'completion';
  recipient: string;
  workflowId: string;
  stageId?: string;
  title: string;
  message: string;
  actionRequired: boolean;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sentAt: Date;
  readAt?: Date;
  acknowledged?: boolean;
}

export class ReviewSystem {
  private supabase = createClient();

  async createReviewWorkflow(
    campaign: RenderedCampaign | PopulatedTemplate,
    workflowTemplate: 'standard' | 'expedited' | 'comprehensive' | 'custom',
    options: {},
  name?: string;
      description?: string;
      reviewers?: Reviewer[];
      customStages?: Partial<ReviewStage>[];
      deadline?: Date;
      priority?: ReviewWorkflow['priority'];
      createdBy: string;
    }
  ): Promise<ReviewWorkflow> {
    try {
      logger.info('Creating review workflow', {
        campaignId: campaign.id,
        workflowTemplate,
        priority: options.priority
      });

      // Generate workflow stages based on template
      const stages = this.generateWorkflowStages(workflowTemplate, options.customStages);

      // Assign reviewers to stages
      await this.assignReviewersToStages(stages, options.reviewers || []);

      const workflow: ReviewWorkflow = {
        id: this.generateWorkflowId(),
        campaignId: campaign.id,
        briefId: campaign.briefId,
        name: options.name || `Review: ${campaign.name}`,
        description: options.description || `Review workflow for ${campaign.name}`,
        stages,
        currentStage: 0,
        status: 'pending',
        priority: options.priority || 'medium',
        deadline: options.deadline,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: options.createdBy,
        metadata: {},
        totalStages: stages.length,
          completedStages: 0,
          averageReviewTime: 0,
          escalations: 0,
          revisionRounds: 0
        
      }
      };

      // Save to database
      await this.saveWorkflow(workflow);

      // Send initial notifications
      await this.sendStageNotifications(workflow, stages[0]);

      // Start workflow
      workflow.status = 'in-review';
      await this.updateWorkflow(workflow);

      return workflow;

    } catch (error: any) {
      logger.error('Failed to create review workflow', error);
      throw error;
    }
  }

  async submitReview(
    workflowId: string,
    stageId: string,
    reviewerId: string,
    submission: Omit<ReviewSubmission, 'id' | 'workflowId' | 'stageId' | 'reviewerId' | 'submittedAt'>
  ): Promise<{
    success: boolean;
    nextStage?: ReviewStage;
    workflowStatus: ReviewWorkflow['status'];
    notifications: ReviewNotification[];
  }> {
    try {
      logger.info('Processing review submission', {
        workflowId,
        stageId,
        reviewerId,
        decision: submission.decision
      });

      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const stage = workflow.stages.find((s: any) => s.id === stageId);
      if (!stage) {
        throw new Error('Stage not found');
      }

      const reviewer = stage.reviewers.find((r: any) => r.id === reviewerId);
      if (!reviewer) {
        throw new Error('Reviewer not found in stage');
      }

      // Create review submission
      const reviewSubmission: ReviewSubmission = {
        id: this.generateSubmissionId(),
        workflowId,
        stageId,
        reviewerId,
        submittedAt: new Date(),
        ...submission
      };

      // Save submission
      await this.saveReviewSubmission(reviewSubmission);

      // Update reviewer status
      reviewer.status = 'completed';
      reviewer.responseTime = this.calculateResponseTime(reviewer.assignedAt, new Date());

      // Check if stage is complete
      const stageComplete = await this.checkStageCompletion(workflow, stage);
      let nextStage: ReviewStage | undefined;
      let notifications: ReviewNotification[] = [];

      if (stageComplete) {
        // Move to next stage or complete workflow
        const result = await this.progressWorkflow(workflow);
        nextStage = result.nextStage;
        notifications = result.notifications;
      }

      // Process revision requests
      if (submission.decision === 'request_revision') {
        await this.handleRevisionRequest(workflow, reviewSubmission);
      }

      return {
        success: true,
        nextStage,
        workflowStatus: workflow.status,
        notifications
      };

    } catch (error: any) {
      logger.error('Failed to submit review', error);
      throw error;
    }
  }

  async getWorkflowStatus(workflowId: string): Promise<{
    workflow: ReviewWorkflow;
    currentStage: ReviewStage;
    pendingReviewers: Reviewer[];
    recentActivity: ReviewSubmission[];
    analytics: ReviewAnalytics;
  } | null> {
    try {
      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) return null;

      const currentStage = workflow.stages[workflow.currentStage];
      const pendingReviewers = currentStage?.reviewers.filter((r: any) => r.status === 'assigned') || [];
      
      const recentActivity = await this.getRecentActivity(workflowId, 10);
      const analytics = await this.generateAnalytics(workflow);

      return {
        workflow,
        currentStage,
        pendingReviewers,
        recentActivity,
        analytics
      };

    } catch (error: any) {
      logger.error('Failed to get workflow status', error);
      throw error;
    }
  }

  async addComment(
    workflowId: string,
    stageId: string,
    comment: Omit<ReviewComment, 'id' | 'createdAt' | 'status'>
  ): Promise<ReviewComment> {
    try {
      const reviewComment: ReviewComment = {
        id: this.generateCommentId(),
        status: 'open',
        createdAt: new Date(),
        ...comment
      };

      await this.saveComment(reviewComment);

      // Send notification if it's a critical issue
      if (comment.severity === 'critical') {
        await this.sendCriticalIssueNotification(workflowId, reviewComment);
      }

      return reviewComment;

    } catch (error: any) {
      logger.error('Failed to add comment', error);
      throw error;
    }
  }

  async resolveComment(
    commentId: string,
    resolvedBy: string,
    resolution?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('review_comments')
        .update({
          status: 'resolved',
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
          resolution
        })
        .eq('id', commentId);

    } catch (error: any) {
      logger.error('Failed to resolve comment', error);
      throw error;
    }
  }

  async escalateWorkflow(
    workflowId: string,
    reason: string,
    escalatedBy: string,
    escalateTo: string[]
  ): Promise<void> {
    try {
      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      workflow.metadata.escalations += 1;
      await this.updateWorkflow(workflow);

      // Send escalation notifications
      const notifications = escalateTo.map((userId: any) => ({
        id: this.generateNotificationId(),
        type: 'escalation' as const,
        recipient: userId,
        workflowId,
        title: 'Review Workflow Escalated',
        message: `Workflow "${workflow.name}" has been escalated. Reason: ${reason}`,
        actionRequired: true,
        priority: 'high' as const,
        sentAt: new Date()
      }));

      await this.sendNotifications(notifications);

      logger.info('Workflow escalated', {
        workflowId,
        reason,
        escalatedBy,
        escalateTo
      });

    } catch (error: any) {
      logger.error('Failed to escalate workflow', error);
      throw error;
    }
  }

  // Private methods
  private generateWorkflowStages(
    template: string,
    customStages?: Partial<ReviewStage>[]
  ): ReviewStage[] {
    const baseStages: Record<string, Partial<ReviewStage>[]> = {
      standard: [
        { name: 'Content Review', type: 'content', approvalThreshold: 'majority', order: 1  }
        { name: 'Creative Review', type: 'creative', approvalThreshold: 'majority', order: 2  }
        { name: 'Final Approval', type: 'final', approvalThreshold: 'all', order: 3 }
      ],
      expedited: [
        { name: 'Quick Review', type: 'content', approvalThreshold: 'any', order: 1  }
        { name: 'Final Approval', type: 'final', approvalThreshold: 'majority', order: 2 }
      ],
      comprehensive: [
        { name: 'Content Review', type: 'content', approvalThreshold: 'majority', order: 1  }
        { name: 'Creative Review', type: 'creative', approvalThreshold: 'majority', order: 2  }
        { name: 'Brand Review', type: 'brand', approvalThreshold: 'all', order: 3  }
        { name: 'Legal Review', type: 'legal', approvalThreshold: 'all', order: 4  }
        { name: 'Technical Review', type: 'technical', approvalThreshold: 'majority', order: 5  }
        { name: 'Final Approval', type: 'final', approvalThreshold: 'all', order: 6 }
      ],
      custom: customStages || []
    };

    const selectedStages = baseStages[template] || baseStages.standard;
    
    return selectedStages.map((stage, index) => ({
      id: this.generateStageId(),
      name: stage.name || `Stage ${index + 1}`,
      description: stage.description || '',
      type: stage.type || 'content',
      reviewers: [],
      requirements: this.generateStageRequirements(stage.type || 'content'),
      status: 'pending',
      approvalThreshold: stage.approvalThreshold || 'majority',
      timeLimit: stage.timeLimit,
      order: stage.order || index + 1,
      isOptional: stage.isOptional || false,
      autoApprove: stage.autoApprove,
      escalationRules: this.generateEscalationRules(stage.type || 'content')
    }));
  }

  private generateStageRequirements(stageType: string): StageRequirement[] {
    const requirementTemplates: Record<string, Partial<StageRequirement>[]> = {
      content: [
        { name: 'Copy Accuracy', type: 'checklist', isRequired: true  }
        { name: 'Tone Consistency', type: 'checklist', isRequired: true  }
        { name: 'Message Clarity', type: 'checklist', isRequired: true }
      ],
      creative: [
        { name: 'Visual Impact', type: 'checklist', isRequired: true  }
        { name: 'Brand Alignment', type: 'checklist', isRequired: true  }
        { name: 'Technical Quality', type: 'checklist', isRequired: true }
      ],
      legal: [
        { name: 'Compliance Check', type: 'approval', isRequired: true  }
        { name: 'Claims Verification', type: 'document', isRequired: true }
      ],
      brand: [
        { name: 'Brand Guidelines', type: 'checklist', isRequired: true  }
        { name: 'Voice & Tone', type: 'checklist', isRequired: true }
      ],
      technical: [
        { name: 'File Quality', type: 'checklist', isRequired: true  }
        { name: 'Format Compliance', type: 'checklist', isRequired: true }
      ],
      final: [
        { name: 'Final Approval', type: 'approval', isRequired: true }
      ]
    };

    const templates = requirementTemplates[stageType] || requirementTemplates.content;
    
    return templates.map((req: any) => ({
      id: this.generateRequirementId(),
      name: req.name || 'Requirement',
      description: req.description || '',
      type: req.type || 'checklist',
      isRequired: req.isRequired !== false
    }));
  }

  private generateEscalationRules(stageType: string): EscalationRule[] {
    return [
      {
        id: this.generateEscalationId(),
        condition: 'time_exceeded',
        threshold: 24, // 24 hours
        action: 'notify' }
      {
        id: this.generateEscalationId(),
        condition: 'time_exceeded',
        threshold: 48, // 48 hours
        action: 'escalate_to_manager'
      }
    ];
  }

  private async assignReviewersToStages(stages: ReviewStage[], reviewers: Reviewer[]): Promise<void> {
    // Simple round-robin assignment for now
    // In production, would use more sophisticated assignment logic
    reviewers.forEach((reviewer, index) => {
      const stageIndex = index % stages.length;
      stages[stageIndex].reviewers.push({
        ...reviewer,
        status: 'assigned',
        assignedAt: new Date()
      });
    });
  }

  private async checkStageCompletion(workflow: ReviewWorkflow, stage: ReviewStage): Promise<boolean> {
    const completedReviewers = stage.reviewers.filter((r: any) => r.status === 'completed');
    const totalReviewers = stage.reviewers.length;

    switch (stage.approvalThreshold) {
      case 'any':
        return completedReviewers.length >= 1;
      case 'majority':
        return completedReviewers.length > totalReviewers / 2;
      case 'all':
        return completedReviewers.length === totalReviewers;
      default:
        return false;
    }
  }

  private async progressWorkflow(workflow: ReviewWorkflow): Promise<{
    nextStage?: ReviewStage;
    notifications: ReviewNotification[];
  }> {
    workflow.metadata.completedStages += 1;
    workflow.currentStage += 1;

    if (workflow.currentStage >= workflow.stages.length) {
      // Workflow complete
      workflow.status = 'completed';
      workflow.updatedAt = new Date();
      await this.updateWorkflow(workflow);

      const notifications = await this.sendCompletionNotifications(workflow);
      return { notifications };
    } else {
      // Move to next stage
      const nextStage = workflow.stages[workflow.currentStage];
      nextStage.status = 'in-progress';
      workflow.updatedAt = new Date();
      await this.updateWorkflow(workflow);

      const notifications = await this.sendStageNotifications(workflow, nextStage);
      return { nextStage, notifications };
    }
  }

  private async handleRevisionRequest(workflow: ReviewWorkflow, submission: ReviewSubmission): Promise<void> {
    workflow.metadata.revisionRounds += 1;
    workflow.status = 'revision-requested';
    await this.updateWorkflow(workflow);

    // Send revision notification to campaign creator
    const notification: ReviewNotification = {
      id: this.generateNotificationId(),
      type: 'rejection',
      recipient: workflow.createdBy,
      workflowId: workflow.id,
      title: 'Revision Requested',
      message: `Revisions have been requested for "${workflow.name}"`,
      actionRequired: true,
      priority: 'high',
      sentAt: new Date()
    };

    await this.sendNotifications([notification]);
  }

  private calculateResponseTime(assignedAt: Date, completedAt: Date): number {
    return Math.round((completedAt.getTime() - assignedAt.getTime()) / (1000 * 60 * 60)); // hours
  }

  private async generateAnalytics(workflow: ReviewWorkflow): Promise<ReviewAnalytics> {
    // Calculate performance metrics
    const totalTime = workflow.updatedAt.getTime() - workflow.createdAt.getTime();
    const completedStages = workflow.stages.filter((s: any) => s.status === 'approved').length;
    const averageStageTime = completedStages > 0 ? totalTime / completedStages : 0;

    // Calculate efficiency (simplified)
    const expectedTime = workflow.stages.length * 24 * 60 * 60 * 1000; // 24 hours per stage
    const efficiency = Math.min(100, Math.max(0, 100 - ((totalTime - expectedTime) / expectedTime) * 100));

    return {
      workflowId: workflow.id,
      performance: {},
  totalTime,
        averageStageTime,
        bottlenecks: [], // Would calculate based on stage times
        efficiency
      },
      participation: {},
  totalReviewers: workflow.stages.reduce((sum, stage) => sum + stage.reviewers.length, 0),
        activeReviewers: workflow.stages.reduce((sum, stage) => 
          sum + stage.reviewers.filter((r: any) => r.status === 'reviewing').length, 0
        ),
        averageResponseTime: 0, // Would calculate from submission data
        topPerformers: [] // Would rank reviewers by performance },
  quality: {},
  totalComments: 0, // Would count from comments table
        issuesFound: 0,
        issuesResolved: 0,
        revisionRounds: workflow.metadata.revisionRounds,
        finalApprovalScore: 0 // Would calculate based on feedback
      }
    };
  }

  private async sendStageNotifications(workflow: ReviewWorkflow, stage: ReviewStage): Promise<ReviewNotification[]> {
    const notifications: ReviewNotification[] = stage.reviewers.map((reviewer: any) => ({
      id: this.generateNotificationId(),
      type: 'assignment',
      recipient: reviewer.userId,
      workflowId: workflow.id,
      stageId: stage.id,
      title: 'Review Assignment',
      message: `You have been assigned to review "${workflow.name}" at stage "${stage.name}"`,
      actionRequired: true,
      priority: workflow.priority,
      sentAt: new Date()
    }));

    await this.sendNotifications(notifications);
    return notifications;
  }

  private async sendCompletionNotifications(workflow: ReviewWorkflow): Promise<ReviewNotification[]> {
    const notification: ReviewNotification = {
      id: this.generateNotificationId(),
      type: 'completion',
      recipient: workflow.createdBy,
      workflowId: workflow.id,
      title: 'Review Completed',
      message: `Review workflow for "${workflow.name}" has been completed`,
      actionRequired: false,
      priority: 'medium',
      sentAt: new Date()
    };

    await this.sendNotifications([notification]);
    return [notification];
  }

  private async sendCriticalIssueNotification(workflowId: string, comment: ReviewComment): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return;

    const notification: ReviewNotification = {
      id: this.generateNotificationId(),
      type: 'escalation',
      recipient: workflow.createdBy,
      workflowId,
      title: 'Critical Issue Identified',
      message: `A critical issue has been identified: ${comment.content}`,
      actionRequired: true,
      priority: 'urgent',
      sentAt: new Date()
    };

    await this.sendNotifications([notification]);
  }

  private async sendNotifications(notifications: ReviewNotification[]): Promise<void> {
    for (const notification of notifications) {
      await this.supabase
        .from('review_notifications')
        .insert({
          id: notification.id,
          type: notification.type,
          recipient: notification.recipient,
          workflow_id: notification.workflowId,
          stage_id: notification.stageId,
          title: notification.title,
          message: notification.message,
          action_required: notification.actionRequired,
          action_url: notification.actionUrl,
          priority: notification.priority,
          sent_at: notification.sentAt.toISOString()
        });
    }

    logger.info('Notifications sent', { count: notifications.length });
  }

  // Database operations
  private async getWorkflow(workflowId: string): Promise<ReviewWorkflow | null> {
    const { data, error } = await this.supabase
      .from('review_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToWorkflow(data);
  }

  private async saveWorkflow(workflow: ReviewWorkflow): Promise<void> {
    const { error } = await this.supabase
      .from('review_workflows')
      .insert({
        id: workflow.id,
        campaign_id: workflow.campaignId,
        brief_id: workflow.briefId,
        name: workflow.name,
        description: workflow.description,
        stages: workflow.stages,
        current_stage: workflow.currentStage,
        status: workflow.status,
        priority: workflow.priority,
        deadline: workflow.deadline?.toISOString(),
        created_at: workflow.createdAt.toISOString(),
        updated_at: workflow.updatedAt.toISOString(),
        created_by: workflow.createdBy,
        metadata: workflow.metadata
      });

    if (error) throw error;
  }

  private async updateWorkflow(workflow: ReviewWorkflow): Promise<void> {
    const { error } = await this.supabase
      .from('review_workflows')
      .update({
        stages: workflow.stages,
        current_stage: workflow.currentStage,
        status: workflow.status,
        updated_at: workflow.updatedAt.toISOString(),
        metadata: workflow.metadata
      })
      .eq('id', workflow.id);

    if (error) throw error;
  }

  private async saveReviewSubmission(submission: ReviewSubmission): Promise<void> {
    const { error } = await this.supabase
      .from('review_submissions')
      .insert({
        id: submission.id,
        workflow_id: submission.workflowId,
        stage_id: submission.stageId,
        reviewer_id: submission.reviewerId,
        decision: submission.decision,
        comments: submission.comments,
        attachments: submission.attachments,
        submitted_at: submission.submittedAt.toISOString(),
        time_spent: submission.timeSpent,
        next_stage_recommendation: submission.nextStageRecommendation
      });

    if (error) throw error;
  }

  private async saveComment(comment: ReviewComment): Promise<void> {
    const { error } = await this.supabase
      .from('review_comments')
      .insert({
        id: comment.id,
        type: comment.type,
        severity: comment.severity,
        content: comment.content,
        element_id: comment.elementId,
        position: comment.position,
        category: comment.category,
        status: comment.status,
        created_by: comment.createdBy,
        created_at: comment.createdAt.toISOString(),
        tags: comment.tags
      });

    if (error) throw error;
  }

  private async getRecentActivity(workflowId: string, limit: number): Promise<ReviewSubmission[]> {
    const { data, error } = await this.supabase
      .from('review_submissions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => this.mapRowToSubmission(row));
  }

  private mapRowToWorkflow(row: any): ReviewWorkflow {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      briefId: row.brief_id,
      name: row.name,
      description: row.description,
      stages: row.stages || [],
      currentStage: row.current_stage || 0,
      status: row.status,
      priority: row.priority,
      deadline: row.deadline ? new Date(row.deadline) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      metadata: row.metadata || {}
    };
  }

  private mapRowToSubmission(row: any): ReviewSubmission {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      stageId: row.stage_id,
      reviewerId: row.reviewer_id,
      decision: row.decision,
      comments: row.comments || [],
      attachments: row.attachments || [],
      submittedAt: new Date(row.submitted_at),
      timeSpent: row.time_spent || 0,
      nextStageRecommendation: row.next_stage_recommendation
    };
  }

  // Utility methods
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateStageId(): string {
    return `stage_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateSubmissionId(): string {
    return `submission_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateRequirementId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateEscalationId(): string {
    return `esc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let reviewSystemInstance: ReviewSystem | null = null;

export const getReviewSystem = (): ReviewSystem => {
  if (!reviewSystemInstance) {
    reviewSystemInstance = new ReviewSystem();
  }
  return reviewSystemInstance;
};

// Convenience functions
export const createReviewWorkflow = (
  campaign: RenderedCampaign | PopulatedTemplate,
  workflowTemplate: Parameters<ReviewSystem['createReviewWorkflow']>[1],
  options: Parameters<ReviewSystem['createReviewWorkflow']>[2]
) => {
  return getReviewSystem().createReviewWorkflow(campaign, workflowTemplate, options);
};

export const submitReview = (
  workflowId: string,
  stageId: string,
  reviewerId: string,
  submission: Parameters<ReviewSystem['submitReview']>[3]
) => {
  return getReviewSystem().submitReview(workflowId, stageId, reviewerId, submission);
};

export const getWorkflowStatus = (workflowId: string) => {
  return getReviewSystem().getWorkflowStatus(workflowId);
};