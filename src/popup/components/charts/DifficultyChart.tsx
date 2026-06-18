import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface DifficultyChartProps {
  data: { difficulty: string; count: number }[];
}

const COLORS = {
  Easy: '#10b981', // Emerald 500
  Medium: '#f59e0b', // Amber 500
  Hard: '#ef4444', // Red 500
};

export default function DifficultyChart({ data }: DifficultyChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter(item => item.count > 0 && item.difficulty !== 'All')
      .map(item => ({
        name: item.difficulty,
        value: item.count,
        color: COLORS[item.difficulty as keyof typeof COLORS] || '#94a3b8'
      }));
  }, [data]);

  if (chartData.length === 0) {
    return <div className="h-64 flex items-center justify-center text-slate-500">No difficulty data available</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
