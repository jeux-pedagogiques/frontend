import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';

import { RamCacheService } from 'src/app/theme/shared/service/ram-cache.service';

interface OverviewData {
  total_sessions: number;
  total_games_generated: number;
  counts_by_type: { quiz: number; escape_room: number; pitching: number };
  avg_participation: number;
  participation_by_session: any[];
  bloom_distribution: Record<string, number>;
  aa_success_rates: { aa_source: string; total_attempts: number; correct_count: number; success_rate: number }[];
}

interface SessionDetail {
  session_id: number;
  type: string;
  code_session?: string;
  statut: string;
  mode?: string;
  module_title?: string;
  created_at?: string;
  total_participants?: number;
  aa_results?: { aa_source: string; total_attempts: number; correct_count: number; success_rate: number }[];
  hardest_questions?: { question_id: string; aa_source: string; total_attempts: number; error_rate: number }[];
  participants?: { pseudo: string; score_total: number; attempts_count: number }[];
  // pitching
  titre?: string;
  teams?: any[];
  criteria_averages?: Record<string, number>;
  total_votes?: number;
  total_feedbacks?: number;
  feedbacks?: { author: string; texte: string; sentiment: string; created_at: string }[];
}

interface ComparisonData {
  module_title: string;
  module_id: number;
  total_sessions: number;
  current_session_id: number;
  history: {
    session_id: number;
    code_session: string;
    created_at: string;
    participant_count: number;
    aa_results: { aa_source: string; success_rate: number }[];
    overall_success_rate: number;
  }[];
}

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-prof-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule, NgApexchartsModule],
  templateUrl: './prof-dashboard.component.html',
  styleUrls: ['./prof-dashboard.component.scss']
})
export class ProfDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private ramCache = inject(RamCacheService);

  // State
  pageState = signal<'overview' | 'detail' | 'loading'>('loading');
  isLoading = signal(false);
  errorMessage = signal('');

  // Overview data
  overview = signal<OverviewData | null>(null);
  showChartDetails = signal<Record<string, boolean>>({});

  // Session detail
  sessionDetail = signal<SessionDetail | null>(null);
  comparisonData = signal<ComparisonData | null>(null);
  detailTab = signal<'aa' | 'hardest' | 'participants' | 'feedbacks' | 'comparison'>('aa');

  // Charts
  gameTypeChart!: Partial<ApexOptions>;
  bloomChart!: Partial<ApexOptions>;
  participationChart!: Partial<ApexOptions>;
  aaSuccessChart!: Partial<ApexOptions>;
  comparisonChart!: Partial<ApexOptions>;

  private apiUrl = `${environment.apiUrl}/api/dashboard`;

  // Bloom level labels
  bloomLabels: Record<string, string> = {
    'memoriser': 'Mémoriser',
    'comprendre': 'Comprendre',
    'appliquer': 'Appliquer',
    'analyser': 'Analyser',
    'evaluer': 'Évaluer',
    'creer': 'Créer'
  };

  bloomColors: Record<string, string> = {
    'memoriser': '#ef4444',
    'comprendre': '#f97316',
    'appliquer': '#eab308',
    'analyser': '#22c55e',
    'evaluer': '#3b82f6',
    'creer': '#9f1010'
  };

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    const cached = this.ramCache.get<OverviewData>('dashboard_overview');
    if (cached) {
      this.overview.set(cached);
      this.initCharts(cached);
      this.pageState.set('overview');
      this.isLoading.set(false);
    } else {
      this.pageState.set('loading');
      this.isLoading.set(true);
    }
    this.errorMessage.set('');

    this.http.get<OverviewData>(`${this.apiUrl}/overview`).subscribe({
      next: (data) => {
        this.overview.set(data);
        this.ramCache.set('dashboard_overview', data);
        this.initCharts(data);
        this.pageState.set('overview');
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        if (!cached) {
          this.errorMessage.set(err.error?.detail || 'Erreur lors du chargement du tableau de bord.');
          this.pageState.set('overview');
        }
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  loadSessionDetail(sessionId: number, type: string): void {
    this.pageState.set('loading');
    this.isLoading.set(true);

    this.http.get<SessionDetail>(`${this.apiUrl}/sessions/${sessionId}/details?type=${type}`).subscribe({
      next: (data) => {
        this.sessionDetail.set(data);
        this.loadComparison(sessionId);
        this.pageState.set('detail');
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors du chargement de la session.');
        this.pageState.set('overview');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  toggleChartDetails(key: string): void {
    this.showChartDetails.update((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  loadComparison(sessionId: number): void {
    this.http.get<ComparisonData>(`${this.apiUrl}/sessions/${sessionId}/comparison`).subscribe({
      next: (data) => {
        this.comparisonData.set(data);
        this.initComparisonChart(data);
        this.cd.detectChanges();
      },
      error: () => {
        // Comparison not available (no module linked, etc.) — silently ignore
      }
    });
  }

  backToOverview(): void {
    this.pageState.set('overview');
    this.sessionDetail.set(null);
    this.comparisonData.set(null);
    this.detailTab.set('aa');
    this.loadOverview();
  }

  // ========== CHARTS ==========

  initCharts(data: OverviewData): void {
    const isDark = document.body.classList.contains('dark-mode');
    const labelColor = isDark ? '#cbd5e1' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';

    // Game Type Donut
    const types = data.counts_by_type;
    this.gameTypeChart = {
      chart: { type: 'donut', height: 260, foreColor: labelColor },
      labels: ['Quiz', 'Escape Room', 'Pitching'],
      series: [types.quiz, types.escape_room, types.pitching],
      colors: ['#C51414', '#9f1010', '#f59e0b'],
      legend: { position: 'bottom', labels: { colors: labelColor } },
      dataLabels: { enabled: true, dropShadow: { enabled: false } },
      plotOptions: { pie: { donut: { size: '65%' } } }
    };

    // Bloom Distribution Bar
    const bloomEntries = Object.entries(data.bloom_distribution);
    this.bloomChart = {
      chart: { type: 'bar', height: 260, toolbar: { show: false }, foreColor: labelColor },
      series: [{ name: 'Nombre d\'AA', data: bloomEntries.map(([, v]) => v) }],
      xaxis: {
        categories: bloomEntries.map(([k]) => this.bloomLabels[k] || k),
        labels: { style: { fontSize: '11px', colors: labelColor } }
      },
      yaxis: { labels: { style: { colors: labelColor } } },
      colors: bloomEntries.map(([k]) => this.bloomColors[k] || '#6b7280'),
      plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
      dataLabels: { enabled: false },
      grid: { borderColor: gridColor }
    };

    // Participation by Session (bar chart)
    const sessions = data.participation_by_session.filter(s => s.type !== 'pitching');
    this.participationChart = {
      chart: { type: 'bar', height: 260, toolbar: { show: false }, foreColor: labelColor },
      series: [{ name: 'Participants', data: sessions.map(s => s.participant_count) }],
      xaxis: {
        categories: sessions.map(s => s.code_session || `S${s.session_id}`),
        labels: { style: { fontSize: '10px', colors: labelColor } }
      },
      yaxis: { labels: { style: { colors: labelColor } } },
      colors: ['#C51414'],
      plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
      dataLabels: { enabled: false },
      grid: { borderColor: gridColor }
    };

    // AA Success Rates (horizontal bar)
    const aaData = data.aa_success_rates;
    this.aaSuccessChart = {
      chart: { type: 'bar', height: Math.max(200, aaData.length * 35), toolbar: { show: false }, foreColor: labelColor },
      series: [{ name: 'Taux de réussite %', data: aaData.map(a => a.success_rate) }],
      xaxis: {
        categories: aaData.map(a => a.aa_source),
        labels: { style: { fontSize: '11px', colors: labelColor } },
        max: 100
      },
      yaxis: { labels: { style: { colors: labelColor } } },
      colors: ['#22c55e'],
      plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '60%' } },
      dataLabels: { enabled: true, formatter: (val: number) => `${val}%`, style: { colors: [isDark ? '#ffffff' : '#1e293b'] } },
      grid: { borderColor: gridColor }
    };
  }

  initComparisonChart(data: ComparisonData): void {
    if (!data.history || data.history.length === 0) return;

    const isDark = document.body.classList.contains('dark-mode');
    const labelColor = isDark ? '#cbd5e1' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';

    this.comparisonChart = {
      chart: { type: 'line', height: 280, toolbar: { show: false }, foreColor: labelColor },
      series: [{
        name: 'Taux de réussite global %',
        data: data.history.map(h => h.overall_success_rate)
      }],
      xaxis: {
        categories: data.history.map(h => {
          const d = new Date(h.created_at);
          return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        }),
        labels: { style: { fontSize: '10px', colors: labelColor } }
      },
      colors: ['#C51414'],
      stroke: { width: 3, curve: 'smooth' },
      markers: { size: 6 },
      dataLabels: { enabled: false },
      grid: { borderColor: gridColor },
      yaxis: { min: 0, max: 100, labels: { formatter: (val: number) => `${val}%`, style: { colors: labelColor } } }
    };
  }

  // ========== HELPERS ==========

  getBloomLabel(level: string): string {
    return this.bloomLabels[level] || level;
  }

  getSuccessColor(rate: number): string {
    if (rate >= 80) return '#22c55e';
    if (rate >= 60) return '#eab308';
    if (rate >= 40) return '#f97316';
    return '#ef4444';
  }

  getSentimentColor(sentiment: string): string {
    switch (sentiment) {
      case 'positif': return '#22c55e';
      case 'negatif': return '#ef4444';
      default: return '#6b7280';
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  getStatutColor(statut: string): string {
    switch (statut) {
      case 'terminee': return '#22c55e';
      case 'en_cours': return '#f59e0b';
      case 'en_attente': return '#a1a1aa';
      default: return '#a1a1aa';
    }
  }

  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'terminee': return 'Terminée';
      case 'en_cours': return 'En cours';
      case 'en_attente': return 'En attente';
      default: return statut;
    }
  }

  getCriteriaEntries(): { key: string; value: number }[] {
    const avgs = this.sessionDetail()?.criteria_averages;
    if (!avgs) return [];
    return Object.entries(avgs).map(([key, value]) => ({ key, value: value as number }));
  }
}
