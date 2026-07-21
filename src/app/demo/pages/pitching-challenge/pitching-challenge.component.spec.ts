import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PitchingChallengeComponent } from './pitching-challenge.component';
import { environment } from 'src/environments/environment';

describe('PitchingChallengeComponent', () => {
  let component: PitchingChallengeComponent;
  let fixture: ComponentFixture<PitchingChallengeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PitchingChallengeComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(PitchingChallengeComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the pitching challenge component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with pageState as select', () => {
    expect(component.pageState()).toBe('select');
    expect(component.isConfirmed()).toBeFalse();
    expect(component.isSaving()).toBeFalse();
  });

  it('should update challenge title correctly', () => {
    component.pitchingResult.set({
      titre_challenge: 'Ancien Titre',
      sujet_principal: 'Sujet test',
      sujets_par_equipe: ['Équipe 1'],
      aa_cibles: [],
      criteres_vote: [],
      grille_feedback: { points_positifs: '', axes_amelioration: '', note_synthese: '' },
      questions_debriefing: [],
      fiche_animateur: '',
      fiche_participant: ''
    });

    component.updateTitle('Nouveau Titre Challenge');
    expect(component.pitchingResult()?.titre_challenge).toBe('Nouveau Titre Challenge');
  });

  it('should update main subject correctly', () => {
    component.pitchingResult.set({
      titre_challenge: 'Titre',
      sujet_principal: 'Ancien sujet',
      sujets_par_equipe: [],
      aa_cibles: [],
      criteres_vote: [],
      grille_feedback: { points_positifs: '', axes_amelioration: '', note_synthese: '' },
      questions_debriefing: [],
      fiche_animateur: '',
      fiche_participant: ''
    });

    component.updateSujetPrincipal('Nouveau sujet principal');
    expect(component.pitchingResult()?.sujet_principal).toBe('Nouveau sujet principal');
  });

  it('should update team subjects correctly', () => {
    component.pitchingResult.set({
      titre_challenge: 'Titre',
      sujet_principal: 'Sujet',
      sujets_par_equipe: ['Sujet Équipe 1', 'Sujet Équipe 2'],
      aa_cibles: [],
      criteres_vote: [],
      grille_feedback: { points_positifs: '', axes_amelioration: '', note_synthese: '' },
      questions_debriefing: [],
      fiche_animateur: '',
      fiche_participant: ''
    });

    component.updateSujetEquipe(1, 'Sujet Équipe 2 Modifié');
    expect(component.pitchingResult()?.sujets_par_equipe?.[1]).toBe('Sujet Équipe 2 Modifié');
  });
});
