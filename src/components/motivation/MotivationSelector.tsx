'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  Circle,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  Zap,
  Heart,
  Brain,
  Target,
  Star,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PsychologicalMotivation, MotivationSet } from '@/services/motivationGenerator';

interface MotivationSelectorProps {
  motivationSet: MotivationSet;
  selectedMotivations: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onRefine: (refinements: any) => void;
  onRegenerate: () => void;
  isLoading?: boolean;
  maxSelections?: number;
}

const psychologyTypeIcons = {
  cognitive: Brain,
  emotional: Heart,
  social: Users,
  behavioral: Zap,
};

const psychologyTypeColors = {
  cognitive: 'bg-blue-100 text-blue-800 border-blue-200',
  emotional: 'bg-red-100 text-red-800 border-red-200',
  social: 'bg-green-100 text-green-800 border-green-200',
  behavioral: 'bg-purple-100 text-purple-800 border-purple-200',
};

const intensityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
};

export function MotivationSelector({
  motivationSet,
  selectedMotivations,
  onSelectionChange,
  onRefine,
  onRegenerate,
  isLoading = false,
  maxSelections = 6,
}: MotivationSelectorProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'intensity' | 'alphabetical'>('confidence');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const toggleSelection = (motivationId: string) => {
    const newSelection = selectedMotivations.includes(motivationId)
      ? selectedMotivations.filter((id: any) => id !== motivationId)
      : selectedMotivations.length < maxSelections
        ? [...selectedMotivations, motivationId]
        : selectedMotivations;

    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    const topMotivations = getSortedMotivations()
      .slice(0, maxSelections)
      .map((m: any) => m.id);
    onSelectionChange(topMotivations);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const getSortedMotivations = () => {
    let filtered = motivationSet.motivations;

    if (filterType !== 'all') {
      filtered = filtered.filter((m: any) => m.psychologyType === filterType);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'intensity':
          const intensityOrder = { high: 3, medium: 2, low: 1 };
          return intensityOrder[b.intensity] - intensityOrder[a.intensity];
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const MotivationCard = ({
    motivation,
    isExpanded,
  }: {
    motivation: PsychologicalMotivation;
    isExpanded: boolean;
  }) => {
    const isSelected = selectedMotivations.includes(motivation.id);
    const PsychologyIcon = psychologyTypeIcons[motivation.psychologyType];

    return (
      <Card
        className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:ring-1 hover:ring-gray-300'
        }`}
        onClick={() => toggleSelection(motivation.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              {isSelected ? (
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <CardTitle className="text-lg">{motivation.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                setExpandedCard(isExpanded ? null : motivation.id);
              }}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Badge className={psychologyTypeColors[motivation.psychologyType]}>
              <PsychologyIcon className="h-3 w-3 mr-1" />
              {motivation.psychologyType}
            </Badge>
            <Badge className={intensityColors[motivation.intensity]}>
              {motivation.intensity} intensity
            </Badge>
            <Badge variant="outline">
              <Star className="h-3 w-3 mr-1" />
              <span className={getConfidenceColor(motivation.confidence)}>
                {Math.round(motivation.confidence * 100)}%
              </span>
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-gray-600 mb-3">{motivation.description}</p>

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Target:</span> {motivation.targetSegment}
            </div>
            <div>
              <span className="font-medium">Key Message:</span> {motivation.keyMessage}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-3 border-t pt-3">
              <div>
                <span className="font-medium text-sm">Emotional Triggers:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {motivation.emotionalTriggers.map((trigger, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-medium text-sm">Copy Direction:</span>
                <p className="text-sm text-gray-600 mt-1">{motivation.copyDirection}</p>
              </div>

              <div>
                <span className="font-medium text-sm">Examples:</span>
                <ul className="text-sm text-gray-600 mt-1 list-disc list-inside">
                  {motivation.examples.map((example, idx) => (
                    <li key={idx}>{example}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Select Motivations</h2>
            <p className="text-gray-600">
              Choose {maxSelections} motivations that best align with your campaign goals (
              {selectedMotivations.length}/{maxSelections} selected)
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onRegenerate} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
            <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Settings className="h-4 w-4 mr-2" />
              Advanced
            </Button>
          </div>
        </div>

        {/* Metadata Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Motivations</p>
                  <p className="text-2xl font-bold">{motivationSet.motivations.length}</p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
                  <p className="text-2xl font-bold">
                    {Math.round(motivationSet.metadata.averageConfidence * 100)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Diversity Score</p>
                  <p className="text-2xl font-bold">
                    {Math.round(motivationSet.metadata.diversityScore * 100)}%
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Target Segments</p>
                  <p className="text-2xl font-bold">
                    {motivationSet.metadata.targetCoverage.length}
                  </p>
                </div>
                <Zap className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Controls */}
        {showAdvanced && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Advanced Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="filter-type">Filter by Psychology Type</Label>
                  <select
                    id="filter-type"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="all">All Types</option>
                    <option value="cognitive">Cognitive</option>
                    <option value="emotional">Emotional</option>
                    <option value="social">Social</option>
                    <option value="behavioral">Behavioral</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="sort-by">Sort By</Label>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="confidence">Confidence</option>
                    <option value="intensity">Intensity</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="view-mode">View Mode</Label>
                  <select
                    id="view-mode"
                    value={viewMode}
                    onChange={e => setViewMode(e.target.value as any)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between">
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select Top {maxSelections}
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    Clear All
                  </Button>
                </div>

                <Button
                  onClick={() =>
                    onRefine({
                      enhanceConfidence: true,
                      increaseDiversity: true,
                      balancePsychology: true,
                    })
                  }
                  disabled={isLoading}
                >
                  Refine Motivations
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selection Warning */}
      {selectedMotivations.length === 0 && (
        <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            Please select at least one motivation to continue.
          </p>
        </div>
      )}

      {/* Motivations Grid/List */}
      <div
        className={
          viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'
        }
      >
        {getSortedMotivations().map((motivation: any) => (
          <MotivationCard
            key={motivation.id}
            motivation={motivation}
            isExpanded={expandedCard === motivation.id}
          />
        ))}
      </div>

      {/* Psychology Distribution Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Psychology Type Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(motivationSet.metadata.psychologyDistribution).map(([type, count]) => {
              const percentage = (count / motivationSet.motivations.length) * 100;
              const PsychologyIcon = psychologyTypeIcons[type as keyof typeof psychologyTypeIcons];

              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <PsychologyIcon className="h-4 w-4" />
                    <span className="font-medium capitalize">{type}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12">{Math.round(percentage)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Motivations Summary */}
      {selectedMotivations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selected Motivations Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedMotivations.map((id: any) => {
                const motivation = motivationSet.motivations.find((m: any) => m.id === id);
                if (!motivation) return null;

                return (
                  <div
                    key={id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="font-medium">{motivation.title}</span>
                    <div className="flex items-center space-x-2">
                      <Badge className={psychologyTypeColors[motivation.psychologyType]}>
                        {motivation.psychologyType}
                      </Badge>
                      <Badge className={intensityColors[motivation.intensity]}>
                        {motivation.intensity}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
