import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from 'src/environments/environment';

type PageState = 'loading' | 'name-entry' | 'playing' | 'completed' | 'error';
type GameType = 'quiz' | 'escape_room' | 'flashcards' | 'pitching' | 'cas_etude' | 'mindmap';

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './play.component.html',
  styleUrls: ['./play.component.scss'],
})
export class PlayComponent implements OnInit, OnDestroy {
  private apiUrl = `${environment.apiUrl}/api/shares`;

  // Core state
  pageState = signal<PageState>('loading');
  errorMessage = signal('');
  shareToken = signal('');
  gameType = signal<GameType>('quiz');
  gameTitle = signal('');
  gameData = signal<any>(null);

  // Student
  studentName = signal('');
  studentNameInput = '';
  enigmaAnswerInput = '';

  // Timer
  startTime = 0;
  elapsedSeconds = signal(0);
  private timerInterval: any;

  // ─── Quiz State ───
  quizQuestions = signal<any[]>([]);
  quizCurrentIndex = signal(0);
  quizSelectedAnswer = signal<string | null>(null);
  quizAnswered = signal(false);
  quizScore = signal(0);
  quizResults = signal<any[]>([]);

  // ─── Flashcard State ───
  flashcards = signal<any[]>([]);
  flashcardIndex = signal(0);
  flashcardFlipped = signal(false);
  flashcardResults = signal<{ id: number; status: string }[]>([]);

  // ─── Escape Room State ───
  enigmas = signal<any[]>([]);
  enigmaIndex = signal(0);
  enigmaAnswer = signal('');
  enigmaHintShown = signal(false);
  enigmaResults = signal<{ index: number; solved: boolean; attempts: number }[]>([]);
  enigmaAttempts = signal(0);
  enigmaFeedback = signal<'correct' | 'wrong' | null>(null);

  // ─── Pitching State ───
  pitchingTeams = signal<any[]>([]);
  pitchingCriteria = signal<any[]>([]);
  pitchingCurrentTeam = signal(0);
  pitchingVotes = signal<any[]>([]);
  pitchingFeedbackText = signal('');
  claimedSubjects = signal<{ subject_index: number; subject_title: string; student_name: string }[]>([]);
  selectedSubjectIndex = signal<number | null>(null);
  selectedSubjectTitle = signal<string>('');
  isClaimingSubject = signal(false);
  subjectClaimError = signal('');

  // ─── Cas Etude State ───
  casEtudeQuestions = signal<any[]>([]);
  casEtudeDecisions = signal<Record<string, { decision: string; justification: string }>>({});

  // Computed
  quizProgress = computed(() => {
    const total = this.quizQuestions().length;
    return total > 0 ? ((this.quizCurrentIndex() + 1) / total) * 100 : 0;
  });

  flashcardProgress = computed(() => {
    const total = this.flashcards().length;
    return total > 0 ? ((this.flashcardIndex() + 1) / total) * 100 : 0;
  });

  enigmaProgress = computed(() => {
    const total = this.enigmas().length;
    return total > 0 ? ((this.enigmaIndex() + 1) / total) * 100 : 0;
  });

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') || '';
    const gameType = this.route.snapshot.paramMap.get('gameType') || '';
    this.shareToken.set(token);
    this.gameType.set(gameType as GameType);

    this.http.get<any>(`${this.apiUrl}/${token}`).subscribe({
      next: (data) => {
        this.gameTitle.set(data.titre || 'Jeu Partagé');
        this.gameData.set(data.game_data);
        this.gameType.set(data.game_type as GameType);
        if (data.claimed_subjects) {
          this.claimedSubjects.set(data.claimed_subjects);
        }
        this.pageState.set('name-entry');
      },
      error: () => {
        this.errorMessage.set('Ce lien de partage est invalide ou a expiré.');
        this.pageState.set('error');
      },
    });
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  startGame() {
    if (!this.studentName().trim()) return;
    this.pageState.set('playing');
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.set(Math.floor((Date.now() - this.startTime) / 1000));
    }, 1000);
    this.initGameData();
  }

  private initGameData() {
    const data = this.gameData();
    switch (this.gameType()) {
      case 'quiz':
        const questions = data?.questions || data?.quiz?.questions || [];
        this.quizQuestions.set(questions);
        break;
      case 'flashcards':
        this.flashcards.set(data?.cards || []);
        break;
      case 'escape_room':
        const enigmes = data?.enigmes || [];
        this.enigmas.set(enigmes);
        break;
      case 'pitching':
        try {
          const desc = typeof data?.description === 'string' ? JSON.parse(data.description) : data?.description || data;
          this.pitchingTeams.set(desc?.sujets_par_equipe || desc?.teams || []);
          this.pitchingCriteria.set(desc?.criteres_evaluation || desc?.criteria || []);
        } catch {
          this.pitchingTeams.set([]);
          this.pitchingCriteria.set([]);
        }
        break;
      case 'cas_etude':
        this.casEtudeQuestions.set(data?.questions_decisions || []);
        break;
      case 'mindmap':
        this.mindmapBranches.set(data?.branches_suggerees || []);
        break;
    }
  }

  // ─── Quiz Methods ───
  selectQuizAnswer(answer: string) {
    if (this.quizAnswered()) return;
    this.quizSelectedAnswer.set(answer);
    this.quizAnswered.set(true);

    const q = this.quizQuestions()[this.quizCurrentIndex()];
    const correct = answer === q.reponse_correcte || answer === q.correct_answer || answer === q.bonne_reponse;
    if (correct) this.quizScore.update((s) => s + 1);

    this.quizResults.update((r) => [...r, {
      question: q.question || q.enonce,
      answer,
      correct,
    }]);

    setTimeout(() => this.nextQuizQuestion(), 1200);
  }

  private nextQuizQuestion() {
    const next = this.quizCurrentIndex() + 1;
    if (next >= this.quizQuestions().length) {
      this.completeGame();
    } else {
      this.quizCurrentIndex.set(next);
      this.quizSelectedAnswer.set(null);
      this.quizAnswered.set(false);
    }
  }

  getQuizOptions(q: any): string[] {
    if (q.options && q.options.length > 0) return q.options;
    if (q.propositions && q.propositions.length > 0) return q.propositions;
    if (q.choix && q.choix.length > 0) return q.choix.map((c: any) => typeof c === 'string' ? c : c.texte);

    // Vrai/Faux questions without explicit options
    const type = (q.type || '').toLowerCase();
    if (type === 'vrai_faux' || type === 'vrai/faux' || type === 'true_false') {
      return ['Vrai', 'Faux'];
    }

    // If there's a correct answer, build minimal options
    const correct = q.reponse_correcte || q.correct_answer || q.bonne_reponse;
    if (correct) {
      if (correct === 'Vrai' || correct === 'Faux' || correct === 'vrai' || correct === 'faux') {
        return ['Vrai', 'Faux'];
      }
      return [correct];
    }

    return [];
  }

  isCorrectAnswer(q: any, option: string): boolean {
    return option === q.reponse_correcte || option === q.correct_answer || option === q.bonne_reponse;
  }

  // ─── Flashcard Methods ───
  flipCard() {
    this.flashcardFlipped.update((f) => !f);
  }

  reviewFlashcard(status: 'bien_su' | 'mal_su') {
    const card = this.flashcards()[this.flashcardIndex()];
    this.flashcardResults.update((r) => [...r, { id: card.id, status }]);
    this.flashcardFlipped.set(false);

    const next = this.flashcardIndex() + 1;
    if (next >= this.flashcards().length) {
      this.completeGame();
    } else {
      this.flashcardIndex.set(next);
    }
  }

  // ─── Escape Room Methods ───
  checkEnigmaAnswer() {
    const enigma = this.enigmas()[this.enigmaIndex()];
    const userAnswer = this.enigmaAnswer().trim().toLowerCase();
    const correctCode = (enigma.code_deverrouillage_suivant || enigma.code || '').toString().trim().toLowerCase();

    this.enigmaAttempts.update((a) => a + 1);

    if (userAnswer === correctCode) {
      this.enigmaFeedback.set('correct');
      this.enigmaResults.update((r) => [...r, {
        index: this.enigmaIndex(),
        solved: true,
        attempts: this.enigmaAttempts(),
      }]);
      setTimeout(() => this.nextEnigma(), 1000);
    } else {
      this.enigmaFeedback.set('wrong');
      setTimeout(() => this.enigmaFeedback.set(null), 1500);
    }
  }

  toggleEnigmaHint() {
    this.enigmaHintShown.update((h) => !h);
  }

  private nextEnigma() {
    const next = this.enigmaIndex() + 1;
    if (next >= this.enigmas().length) {
      this.completeGame();
    } else {
      this.enigmaIndex.set(next);
      this.enigmaAnswer.set('');
      this.enigmaHintShown.set(false);
      this.enigmaFeedback.set(null);
      this.enigmaAttempts.set(0);
    }
  }

  // ─── Pitching Methods ───
  submitPitchingVote(teamIndex: number, score: number) {
    this.pitchingVotes.update((v) => {
      const filtered = v.filter((x) => x.teamIndex !== teamIndex);
      return [...filtered, { teamIndex, score }];
    });
  }

  nextPitchingTeam() {
    const next = this.pitchingCurrentTeam() + 1;
    if (next >= this.pitchingTeams().length) {
      this.completeGame();
    } else {
      this.pitchingCurrentTeam.set(next);
    }
  }

  getPitchingVote(teamIndex: number): number {
    return this.pitchingVotes().find((v) => v.teamIndex === teamIndex)?.score || 0;
  }

  isSubjectClaimed(index: number): boolean {
    return this.claimedSubjects().some((c) => c.subject_index === index);
  }

  getSubjectClaimedBy(index: number): string {
    const claim = this.claimedSubjects().find((c) => c.subject_index === index);
    return claim ? claim.student_name : '';
  }

  selectPitchingSubject(index: number, subject: any) {
    if (this.isSubjectClaimed(index)) return;
    const title = typeof subject === 'string' ? subject : (subject.sujet || subject.topic || `Sujet ${index + 1}`);

    this.isClaimingSubject.set(true);
    this.subjectClaimError.set('');

    this.http.post<any>(`${this.apiUrl}/${this.shareToken()}/claim-subject`, {
      student_name: this.studentName(),
      subject_index: index,
      subject_title: title
    }).subscribe({
      next: () => {
        this.isClaimingSubject.set(false);
        this.selectedSubjectIndex.set(index);
        this.selectedSubjectTitle.set(title);
        this.claimedSubjects.update((list) => [...list, {
          subject_index: index,
          subject_title: title,
          student_name: this.studentName()
        }]);
      },
      error: (err) => {
        this.isClaimingSubject.set(false);
        this.subjectClaimError.set(err.error?.detail || "Ce sujet vient d'être réservé par un autre étudiant !");
        this.refreshSharedGame();
      }
    });
  }

  refreshSharedGame() {
    this.http.get<any>(`${this.apiUrl}/${this.shareToken()}`).subscribe({
      next: (data) => {
        if (data.claimed_subjects) {
          this.claimedSubjects.set(data.claimed_subjects);
        }
      }
    });
  }

  // ─── Complete Game ───
  completeGame() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);

    let score = 0;
    let maxScore = 0;
    let resultData: any = {};

    switch (this.gameType()) {
      case 'quiz':
        score = this.quizScore();
        maxScore = this.quizQuestions().length;
        resultData = { answers: this.quizResults() };
        break;
      case 'flashcards':
        const bienSu = this.flashcardResults().filter((r) => r.status === 'bien_su').length;
        score = bienSu;
        maxScore = this.flashcards().length;
        resultData = { reviews: this.flashcardResults() };
        break;
      case 'escape_room':
        const solved = this.enigmaResults().filter((r) => r.solved).length;
        score = solved;
        maxScore = this.enigmas().length;
        resultData = { enigmas: this.enigmaResults() };
        break;
      case 'pitching':
        score = 1;
        maxScore = 1;
        resultData = {
          claimed_subject_index: this.selectedSubjectIndex(),
          claimed_subject_title: this.selectedSubjectTitle(),
        };
        break;
      case 'cas_etude':
        score = Object.keys(this.casEtudeAnswers()).length;
        maxScore = this.casEtudeQuestions().length || 1;
        resultData = { decisions: this.casEtudeAnswers() };
        break;
      case 'mindmap':
        score = this.mindmapNodes().length;
        maxScore = this.mindmapBranches().length || 1;
        resultData = { nodes: this.mindmapNodes() };
        break;
    }

    this.http.post(`${this.apiUrl}/${this.shareToken()}/results`, {
      student_name: this.studentName(),
      score,
      max_score: maxScore,
      completion_time_seconds: elapsed,
      result_data: resultData,
    }).subscribe({
      next: () => this.pageState.set('completed'),
      error: () => this.pageState.set('completed'),
    });
  }

  // ─── Cas Etude Student Methods ───
  casEtudeAnswers = signal<Record<string, { decision: string; justification: string }>>({});

  updateCasEtudeAnswer(qId: string, field: 'decision' | 'justification', value: string) {
    this.casEtudeAnswers.update((prev) => {
      const current = prev[qId] || { decision: '', justification: '' };
      return {
        ...prev,
        [qId]: {
          ...current,
          [field]: value
        }
      };
    });
  }

  // ─── MindMap Student Methods ───
  mindmapBranches = signal<any[]>([]);
  mindmapNodes = signal<{ branch: string; idea: string }[]>([]);
  mindmapNewIdea = '';
  mindmapSelectedBranch = '';

  addMindmapIdea() {
    if (!this.mindmapNewIdea.trim()) return;
    this.mindmapNodes.update((prev) => [
      ...prev,
      { branch: this.mindmapSelectedBranch || 'Général', idea: this.mindmapNewIdea.trim() }
    ]);
    this.mindmapNewIdea = '';
  }

  removeMindmapIdea(index: number) {
    this.mindmapNodes.update((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Helpers ───
  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  getScorePercent(): number {
    let score = 0, max = 1;
    switch (this.gameType()) {
      case 'quiz': score = this.quizScore(); max = this.quizQuestions().length || 1; break;
      case 'flashcards': score = this.flashcardResults().filter(r => r.status === 'bien_su').length; max = this.flashcards().length || 1; break;
      case 'escape_room': score = this.enigmaResults().filter(r => r.solved).length; max = this.enigmas().length || 1; break;
      case 'pitching': score = 1; max = 1; break;
      case 'cas_etude': score = Object.keys(this.casEtudeAnswers()).length; max = this.casEtudeQuestions().length || 1; break;
      case 'mindmap': score = this.mindmapNodes().length; max = this.mindmapBranches().length || 1; break;
    }
    return Math.round((score / max) * 100);
  }

  isQualitativeGame(): boolean {
    return this.gameType() === 'cas_etude' || this.gameType() === 'pitching' || this.gameType() === 'mindmap';
  }

  getGameTypeLabel(): string {
    const map: Record<string, string> = {
      quiz: 'Quiz',
      escape_room: 'Escape Room',
      flashcards: 'Flashcards',
      pitching: 'Pitching Challenge',
      cas_etude: "Étude de Cas Gamifiée",
      mindmap: "Mind Map Collaboratif",
    };
    return map[this.gameType()] || this.gameType();
  }

  retry() {
    window.location.reload();
  }
}
