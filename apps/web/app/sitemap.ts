import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://thekatanguriskitchen.com';
  const lastModified = new Date('2025-06-01');
  return [
    { url: baseUrl, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/menu`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/cart`, lastModified, changeFrequency: 'never', priority: 0.3 },
    { url: `${baseUrl}/orders`, lastModified, changeFrequency: 'never', priority: 0.3 },
    { url: `${baseUrl}/track`, lastModified, changeFrequency: 'never', priority: 0.4 },
    { url: `${baseUrl}/auth`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/checkout`, lastModified, changeFrequency: 'never', priority: 0.3 },
    { url: `${baseUrl}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
