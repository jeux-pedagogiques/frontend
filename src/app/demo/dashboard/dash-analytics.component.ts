import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ApexOptions, ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import { environment } from 'src/environments/environment';

interface CourseModule {
  id: number;
  module_title: string;
  key_concepts: string[];
  created_at?: string;
}

@Component({
  selector: 'app-dash-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule, NgApexchartsModule],
  templateUrl: './dash-analytics.component.html',
  styleUrls: ['./dash-analytics.component.scss']
})
export class DashAnalyticsComponent implements OnInit {
  private http = inject(HttpClient);

  chart = viewChild<ChartComponent>('chart');

  // Dashboard Signals
  isLoading = signal(true);
  courseModules = signal<CourseModule[]>([]);
  totalModulesCount = signal(0);
  totalGamesCount = signal(0);
  totalSessionsCount = signal(0);
  avgMasteryRate = signal(86);

  // Charts
  activityChart!: Partial<ApexOptions>;
  bloomChart!: Partial<ApexOptions>;
  gameTypeChart!: Partial<ApexOptions>;

  private apiUrl = `${environment.apiUrl}/api`;

  ngOnInit(): void {
    this.initCharts();
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading.set(true);

    // 1. Fetch Course Modules
    this.http.get<CourseModule[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (modules) => {
        this.courseModules.set(modules || []);
        this.totalModulesCount.set(modules.length);
        this.isLoading.set(false);
      },
      error: () => {
        // Fallback default modules for preview if backend is empty
        this.courseModules.set([
          {
            id: 1,
            module_title: 'Droit de la Propriété Intellectuelle (4ème année)',
            key_concepts: ['Propriété intellectuelle', 'Droit d\'auteur', 'Brevets d\'invention'],
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            module_title: 'Architecture Orientée Services (SOA & Web Services)',
            key_concepts: ['SOA', 'Services Web', 'SOAP', 'REST'],
            created_at: new Date().toISOString()
          },
          {
            id: 3,
            module_title: 'Atelier Créatif & Business Plan 2025',
            key_concepts: ['Business Model CANVAS', 'Business Plan', 'Créativité'],
            created_at: new Date().toISOString()
          }
        ]);
        this.totalModulesCount.set(3);
        this.isLoading.set(false);
      }
    });

    // 2. Fetch Overview Stats
    this.http.get<any>(`${this.apiUrl}/dashboard/overview`).subscribe({
      next: (overview) => {
        if (overview) {
          const totalGames = (overview.quiz_count || 0) + (overview.escape_count || 0) + (overview.pitching_count || 0);
          this.totalGamesCount.set(totalGames > 0 ? totalGames : 24);
          this.totalSessionsCount.set(overview.total_sessions || 12);
          if (overview.avg_participation) {
            this.avgMasteryRate.set(Math.round(overview.avg_participation * 10));
          }
        }
      },
      error: () => {
        this.totalGamesCount.set(28);
        this.totalSessionsCount.set(14);
        this.avgMasteryRate.set(88);
      }
    });
  }

  private initCharts(): void {
    // 1. Activity Trend Chart (Monthly AI Generations & Course Imports)
    this.activityChart = {
      chart: {
        height: 260,
        type: 'area',
        toolbar: { show: false },
        zoom: { enabled: false }
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      series: [
        {
          name: 'Activités IA Générées',
          data: [12, 24, 18, 35, 28, 45, 52]
        },
        {
          name: 'Modules Importés',
          data: [5, 8, 6, 12, 10, 15, 18]
        }
      ],
      xaxis: {
        categories: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil'],
        axisBorder: { show: false }
      },
      colors: ['#C51414', '#06b6d4'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        }
      },
      grid: {
        borderColor: 'rgba(255, 255, 255, 0.08)'
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right'
      }
    };

    // 2. Bloom Taxonomy Distribution Chart
    this.bloomChart = {
      chart: {
        height: 240,
        type: 'donut'
      },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Bloom',
                formatter: () => '6 Niveaux'
              }
            }
          }
        }
      },
      labels: ['Mémoriser', 'Comprendre', 'Appliquer', 'Analyser', 'Évaluer', 'Créer'],
      series: [25, 20, 22, 15, 10, 8],
      colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#9f1010'],
      legend: {
        position: 'bottom'
      },
      tooltip: {
        theme: 'dark'
      }
    };

    // 3. Game Type Breakdown Chart
    this.gameTypeChart = {
      chart: {
        height: 240,
        type: 'donut'
      },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Activités',
                formatter: () => '5 Types'
              }
            }
          }
        }
      },
      labels: ['Flashcards', 'Escape Rooms', 'Études de Cas', 'Mind Maps', 'Pitching'],
      series: [30, 20, 25, 15, 10],
      colors: ['#3b82f6', '#f59e0b', '#C51414', '#9f1010', '#10b981'],
      legend: {
        position: 'bottom'
      },
      tooltip: {
        theme: 'dark'
      }
    };
  }
}
