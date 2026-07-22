import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LibraryComponent } from './library.component';

describe('LibraryComponent', () => {
  let component: LibraryComponent;
  let fixture: ComponentFixture<LibraryComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match(() => true).forEach(req => req.flush({ items: [], total: 0, page: 1, page_size: 12, total_pages: 0 }));
    httpMock.verify();
  });

  it('should create the library component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize signals with default values', () => {
    expect(component.currentPage()).toBe(1);
    expect(component.pageSize()).toBe(12);
    expect(component.searchQuery()).toBe('');
    expect(component.selectedGameType()).toBeNull();
    expect(component.selectedModuleId()).toBeNull();
    expect(component.selectedBloomLevels()).toEqual([]);
    expect(component.showArchived()).toBeFalse();
    expect(component.sortOrder()).toBe('desc');
  });

  it('should toggle game type filter correctly', () => {
    component.toggleGameType('quiz');
    expect(component.selectedGameType()).toBe('quiz');
    expect(component.currentPage()).toBe(1);

    // Toggle off
    component.toggleGameType('quiz');
    expect(component.selectedGameType()).toBeNull();
  });

  it('should toggle bloom level filters correctly', () => {
    component.toggleBloomLevel('analyser');
    expect(component.selectedBloomLevels()).toEqual(['analyser']);

    component.toggleBloomLevel('creer');
    expect(component.selectedBloomLevels()).toEqual(['analyser', 'creer']);

    component.toggleBloomLevel('analyser');
    expect(component.selectedBloomLevels()).toEqual(['creer']);
  });

  it('should toggle sort order correctly', () => {
    expect(component.sortOrder()).toBe('desc');
    component.toggleSortOrder();
    expect(component.sortOrder()).toBe('asc');
  });

  it('should helper getGameTypeInfo return correct icon and label', () => {
    const quizInfo = component.getGameTypeInfo('quiz');
    expect(quizInfo.label).toBe('Quiz');
    expect(quizInfo.icon).toBe('feather icon-help-circle');

    const escapeInfo = component.getGameTypeInfo('escape_room');
    expect(escapeInfo.label).toBe('Escape Room');
  });

  it('should helper getBloomInfo return correct emoji and label', () => {
    const bloomInfo = component.getBloomInfo('analyser');
    expect(bloomInfo.label).toBe('Analyser');
    expect(bloomInfo.emoji).toBe('🔬');
  });
});
