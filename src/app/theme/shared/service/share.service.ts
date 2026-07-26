import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ShareService {
  private apiUrl = `${environment.apiUrl}/api/shares`;

  constructor(private http: HttpClient) {}

  createShare(gameType: string, gameId: number): Observable<{ share_token: string; share_url: string }> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ share_token: string; share_url: string }>(
      this.apiUrl,
      { game_type: gameType, game_id: gameId },
      { headers }
    );
  }

  getSharedGame(token: string): Observable<{ game_type: string; game_id: number; titre: string; game_data: any }> {
    return this.http.get<any>(`${this.apiUrl}/${token}`);
  }

  submitResult(token: string, data: {
    student_name: string;
    score?: number;
    max_score?: number;
    completion_time_seconds?: number;
    result_data?: any;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/${token}/results`, data);
  }

  getResults(gameType: string, gameId: number): Observable<{ results: any[]; total: number }> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<{ results: any[]; total: number }>(
      `${this.apiUrl}/results/${gameType}/${gameId}`,
      { headers }
    );
  }
}
