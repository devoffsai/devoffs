
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SkillDNAScore } from '../types';

interface Props {
  data: SkillDNAScore;
  fullSize?: boolean;
}

export const SkillRadar: React.FC<Props> = ({ data, fullSize = false }) => {
  const chartData = [
    { subject: 'Problem Solving', A: data.problemSolving, fullMark: 100 },
    { subject: 'Execution', A: data.executionSpeed, fullMark: 100 },
    { subject: 'Conceptual Depth', A: data.conceptualDepth, fullMark: 100 },
    { subject: 'AI Leverage', A: data.aiLeverage, fullMark: 100 },
    { subject: 'Awareness', A: data.riskAwareness, fullMark: 100 },
  ];

  return (
    <div className={`w-full ${fullSize ? 'h-[400px]' : 'h-[250px]'} flex justify-center items-center bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm overflow-hidden`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart 
          cx="50%" 
          cy="48%" 
          outerRadius={fullSize ? "60%" : "50%"} 
          data={chartData}
          margin={{ top: 10, right: 40, bottom: 10, left: 40 }}
        >
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={(props) => {
              const { x, y, payload } = props;
              const isBottom = payload.value === 'Conceptual Depth';
              const isTop = payload.value === 'Problem Solving';
              return (
                <text
                  x={x}
                  y={y}
                  fill="#94a3b8"
                  fontSize={fullSize ? 11 : 9}
                  fontWeight={500}
                  textAnchor="middle"
                  dy={isBottom ? 18 : isTop ? -10 : 4}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={false} 
            axisLine={false} 
          />
          <Radar
            name="Skill DNA"
            dataKey="A"
            stroke="#06b6d4"
            strokeWidth={3}
            fill="#06b6d4"
            fillOpacity={0.4}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#0f172a', 
              borderColor: '#334155', 
              color: '#f8fafc',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            itemStyle={{ color: '#22d3ee' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
