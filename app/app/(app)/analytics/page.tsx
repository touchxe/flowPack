"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, Eye, Send, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface Stats {
  totalCreated: number;
  totalPublished: number;
  totalViews: number;
}

interface ChartData {
  date: string;
  count: number;
}

interface PlatformStat {
  platform: string;
  views: number;
  likes: number;
}

const platformNames: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TWITTER: "X (Twitter)",
  LINKEDIN: "LinkedIn",
  NAVER_BLOG: "Naver Blog",
  WORDPRESS: "WordPress",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.summary);
        setChartData(data.chartData);
        setPlatformStats(data.platformStats);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/home"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">통계</h1>
            <p className="text-muted-foreground mt-2">
              콘텐츠 성과와 채널별 성능을 확인하세요
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7일</SelectItem>
              <SelectItem value="30">30일</SelectItem>
              <SelectItem value="90">90일</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              생성된 콘텐츠
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : stats?.totalCreated || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              이번 {period === "7" ? "7일" : period === "30" ? "30일" : "90일"}간
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 조회수
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : (stats?.totalViews || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              누적 조회수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              배포 완료
            </CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : stats?.totalPublished || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              이번 {period === "7" ? "7일" : period === "30" ? "30일" : "90일"}간
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        {/* Content Creation Chart */}
        <Card>
          <CardHeader>
            <CardTitle>콘텐츠 생성 추이</CardTitle>
            <CardDescription>일별 생성된 콘텐츠 수</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                로딩 중...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Platform Performance */}
        <Card>
          <CardHeader>
            <CardTitle>채널별 성능</CardTitle>
            <CardDescription>플랫폼별 조회수</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                로딩 중...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={platformStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" fontSize={10} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: "#8884d8" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Table */}
      <Card>
        <CardHeader>
          <CardTitle>채널별 상세</CardTitle>
          <CardDescription>플랫폼별 성과 지표</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">채널</th>
                  <th className="text-right py-3 px-2 font-medium">조회수</th>
                  <th className="text-right py-3 px-2 font-medium">좋아요</th>
                </tr>
              </thead>
              <tbody>
                {platformStats.map((stat) => (
                  <tr key={stat.platform} className="border-b">
                    <td className="py-3 px-2">
                      {platformNames[stat.platform] || stat.platform}
                    </td>
                    <td className="text-right py-3 px-2">
                      {stat.views.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-2">
                      {stat.likes.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
