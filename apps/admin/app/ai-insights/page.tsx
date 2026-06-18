'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Card, SectionTitle, KpiCard, Btn, Badge, AdminStyles, T } from '../ui';
import { getAuthHeaders } from '../../lib/auth-headers';
import { AlertTriangle, Package, MessageSquare, Star, Smile, Frown, Target, Calendar, DollarSign } from 'lucide-react';

interface FeedbackAnalysis {
  id: number;
  orderId: number;
  customerId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  sentiment: string;
  sentimentScore: number;
  sentimentKeywords: string[];
}

interface SentimentSummary {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  avgRating: number;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topComplaints: { theme: string; count: number }[];
}

interface ForecastDay {
  date: string;
  dayOfWeek: string;
  predictedOrders: number;
  predictedRevenue: number;
  topDishes: { dishId: number; dishName: string; predictedQuantity: number }[];
  confidence: number;
  method: string;
}

export default function AiInsightsPage() {
  const [tab, setTab] = useState<'sentiment' | 'forecast'>('sentiment');
  const [feedbacks, setFeedbacks] = useState<FeedbackAnalysis[]>([]);
  const [sentimentSummary, setSentimentSummary] = useState<SentimentSummary | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [forecastSummary, setForecastSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastDays, setForecastDays] = useState(7);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    const h = getAuthHeaders();

    if (tab === 'sentiment') {
      fetch('/api/v1/ai/sentiment/feedbacks', { headers: h })
        .then(async r => {
          if (!r.ok) throw new Error(`Failed to load feedback analysis (${r.status})`);
          return r.json();
        })
        .then(data => {
          setFeedbacks(data.feedbacks || []);
          setSentimentSummary(data.summary);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/v1/ai/forecast?days=${forecastDays}`, { headers: h })
        .then(async r => {
          if (!r.ok) throw new Error(`Failed to load forecast (${r.status})`);
          return r.json();
        })
        .then(data => {
          setForecast(data.forecast || []);
          setForecastSummary(data.summary);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => { fetchData(); }, [tab, forecastDays]);

  if (loading) {
    return (
      <div>
        <AdminStyles />
        <PageHeader icon="🤖" title="AI Insights" subtitle="Loading..." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {Array(4).fill(null).map((_, i) => (
            <Card key={i} style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: T.muted, fontSize: 14 }}>Loading...</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <AdminStyles />
        <PageHeader icon="🤖" title="AI Insights" subtitle="Error loading data" />
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <AlertTriangle size={48} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Unable to load AI insights</h3>
          <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>{error}</p>
          <Btn variant="primary" onClick={fetchData}>Retry</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <AdminStyles />
      <PageHeader 
        icon="🤖" 
        title="AI Insights" 
        subtitle="Sentiment analysis & demand forecasting"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant={tab === 'sentiment' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('sentiment')}>
              💬 Sentiment Analysis
            </Btn>
            <Btn variant={tab === 'forecast' ? 'primary' : 'outline'} size="sm" onClick={() => setTab('forecast')}>
              📈 Demand Forecast
            </Btn>
          </div>
        }
      />

      {tab === 'sentiment' ? (
        <SentimentAnalysisTab 
          feedbacks={feedbacks} 
          summary={sentimentSummary} 
        />
      ) : (
        <ForecastTab 
          forecast={forecast} 
          summary={forecastSummary} 
          days={forecastDays} 
          onDaysChange={setForecastDays} 
        />
      )}
    </div>
  );
}

function SentimentAnalysisTab({ 
  feedbacks, 
  summary 
}: { 
  feedbacks: FeedbackAnalysis[];
  summary: SentimentSummary | null;
}) {
  if (!summary) {
    return (
      <Card style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No feedback data yet</h3>
        <p style={{ color: T.muted, fontSize: 13 }}>Feedback will appear once customers start rating their orders.</p>
      </Card>
    );
  }

  const kpis = [
    { label: 'Total Reviews', value: String(summary.total), icon: <MessageSquare size={24} />, color: '#dbeafe' },
    { label: 'Average Rating', value: `${summary.avgRating}/5`, icon: <Star size={24} />, color: '#fef3c7' },
    { label: 'Positive', value: `${summary.sentimentDistribution.positive}%`, icon: <Smile size={24} />, color: '#dcfce7' },
    { label: 'Negative', value: `${summary.sentimentDistribution.negative}%`, icon: <Frown size={24} />, color: '#fee2e2' },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <Card padding={0}>
          <div style={{ padding: '20px 24px 12px' }}>
            <SectionTitle title="💬 Recent Feedback with Sentiment" icon="💬" />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.hairline}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Order</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Rating</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Comment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Sentiment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Keywords</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.slice(0, 20).map(fb => (
                  <tr key={fb.id} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>#{fb.orderId}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {'⭐'.repeat(fb.rating)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fb.comment || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: fb.sentiment === 'positive' ? '#dcfce7' : fb.sentiment === 'negative' ? '#fee2e2' : '#f3f4f6',
                        color: fb.sentiment === 'positive' ? '#166534' : fb.sentiment === 'negative' ? '#991b1b' : '#6b7280',
                      }}>
                        {fb.sentiment === 'positive' ? '😊 Positive' : fb.sentiment === 'negative' ? '😞 Negative' : '😐 Neutral'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: T.muted }}>
                      {fb.sentimentKeywords.slice(0, 3).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
                {feedbacks.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: T.muted }}>No feedback yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card dark padding={24}>
            <SectionTitle title="📊 Sentiment Distribution" color={T.white} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              {[
                { label: 'Positive', value: summary.sentimentDistribution.positive, color: '#22c55e', icon: '😊' },
                { label: 'Neutral', value: summary.sentimentDistribution.neutral, color: '#6b7280', icon: '😐' },
                { label: 'Negative', value: summary.sentimentDistribution.negative, color: '#ef4444', icon: '😞' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                    <span>{item.icon} {item.label}</span>
                    <span>{item.value}%</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.value}%`, background: item.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {summary.topComplaints.length > 0 && (
            <Card padding={24}>
              <SectionTitle title="🚨 Top Complaint Themes" icon="🚨" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {summary.topComplaints.map((complaint, i) => (
                  <div key={complaint.theme} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#fee2e2',
                    borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#991b1b' }}>
                      {i + 1}. {complaint.theme}
                    </span>
                    <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>
                      {complaint.count}x
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ForecastTab({ 
  forecast, 
  summary, 
  days, 
  onDaysChange 
}: { 
  forecast: ForecastDay[];
  summary: any;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  if (!summary || forecast.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No forecast data yet</h3>
        <p style={{ color: T.muted, fontSize: 13 }}>Forecasts will appear once you have order history.</p>
      </Card>
    );
  }

  const kpis = [
    { label: 'Predicted Orders', value: String(summary.totalPredictedOrders), icon: <Package size={24} />, color: '#dbeafe' },
    { label: 'Predicted Revenue', value: `₹${summary.totalPredictedRevenue.toLocaleString()}`, icon: <DollarSign size={24} />, color: '#dcfce7' },
    { label: 'Avg Confidence', value: `${summary.averageConfidence}%`, icon: <Target size={24} />, color: '#fef3c7' },
    { label: 'Forecast Period', value: `${days} days`, icon: <Calendar size={24} />, color: '#f3e5f5' },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card dark padding={24}>
          <SectionTitle title="📊 Daily Forecast" color={T.white} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {forecast.map(day => (
              <div key={day.date} style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
                      {day.dayOfWeek}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{day.date}</div>
                  </div>
                  <Badge variant="success" style={{ fontSize: 10 }}>
                    {day.confidence}% confidence
                  </Badge>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Orders</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa' }}>
                      {Math.round(day.predictedOrders)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Revenue</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>
                      ₹{Math.round(day.predictedRevenue).toLocaleString()}
                    </div>
                  </div>
                </div>
                {day.topDishes.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Top Dishes to Prep:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {day.topDishes.map(dish => (
                        <span key={dish.dishId} style={{
                          padding: '3px 8px',
                          background: 'rgba(96, 165, 250, 0.15)',
                          borderRadius: 6,
                          fontSize: 11,
                          color: '#93c5fd',
                        }}>
                          {dish.dishName} (×{Math.ceil(dish.predictedQuantity)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card padding={24}>
            <SectionTitle title="🎯 Prep Recommendations" icon="🎯" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {forecast[0]?.topDishes.map((dish, i) => (
                <div key={dish.dishId} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  background: '#f0fdf4',
                  borderRadius: 8,
                  border: '1px solid #bbf7d0',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
                      {i + 1}. {dish.dishName}
                    </div>
                    <div style={{ fontSize: 11, color: '#166534', opacity: 0.7 }}>
                      Based on historical {forecast[0]?.dayOfWeek} patterns
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 18, 
                    fontWeight: 700, 
                    color: '#166534',
                    background: '#dcfce7',
                    padding: '4px 12px',
                    borderRadius: 8,
                  }}>
                    ×{Math.ceil(dish.predictedQuantity)}
                  </div>
                </div>
              ))}
              {forecast[0]?.topDishes.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: 20 }}>
                  No dish predictions available yet.
                </p>
              )}
            </div>
          </Card>

          <Card padding={24}>
            <SectionTitle title="⚙️ Forecast Settings" icon="⚙️" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: 'block', marginBottom: 6 }}>
                  Forecast Period
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[3, 7, 14, 30].map(d => (
                    <Btn 
                      key={d} 
                      variant={days === d ? 'primary' : 'outline'} 
                      size="sm"
                      onClick={() => onDaysChange(d)}
                    >
                      {d} days
                    </Btn>
                  ))}
                </div>
              </div>
              <div style={{ 
                padding: '12px', 
                background: '#f8fafc', 
                borderRadius: 8, 
                fontSize: 12, 
                color: T.muted 
              }}>
                <strong>Method:</strong> {summary.method}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
