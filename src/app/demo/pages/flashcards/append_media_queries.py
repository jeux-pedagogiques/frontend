content = """
// ==========================================================================
// MOBILE RESPONSIVE BREAKPOINTS
// ==========================================================================

@media (max-width: 768px) {
  .flashcards-page {
    padding: 0 2px 12px;

    .fc-top-nav {
      display: flex;
      flex-wrap: wrap;
      border-radius: 14px;
      gap: 4px;

      .nav-tab {
        padding: 8px 14px;
        font-size: 0.78rem;
        flex: 1;
        justify-content: center;
        text-align: center;
      }
    }

    .section-header {
      flex-wrap: wrap;
      gap: 12px;

      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
      }
    }

    .analyses-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .analysis-card {
      padding: 16px 18px;
      min-height: auto;
    }

    .params-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .history-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .generating-state {
      min-height: 320px;
    }

    .generating-content {
      padding: 32px 20px;
      max-width: 100%;
    }

    .flashcard {
      height: 280px;
      max-width: 100%;
    }

    .flashcard-face {
      padding: 24px;
    }

    .card-text {
      font-size: 1rem;
    }

    .complete-card {
      padding: 28px 20px;
      max-width: 100%;
    }

    .complete-stats {
      flex-wrap: wrap;
      gap: 12px;
    }

    .stat-item {
      min-width: 80px;
    }

    .consult-subtabs {
      display: flex;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      gap: 6px;
      padding-bottom: 6px;

      .subtab-btn {
        white-space: nowrap;
        flex-shrink: 0;
        padding: 8px 14px;
        font-size: 0.78rem;
      }
    }

    .consult-card-viewer {
      .card-container {
        .flashcard {
          height: 280px;
        }
      }
    }

    .consult-nav-controls {
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .fc-table {
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      white-space: nowrap;
    }

    .session-progress {
      max-width: 100%;
    }

    .review-actions {
      flex-wrap: wrap;
      gap: 10px;
    }

    .aa-stats-section {
      .aa-stat-row {
        flex-wrap: wrap;
        gap: 6px;
      }
    }

    .stats-overview-grid {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
  }
}

@media (max-width: 576px) {
  .flashcards-page {
    .fc-top-nav {
      .nav-tab {
        padding: 7px 10px;
        font-size: 0.75rem;
        gap: 5px;

        i {
          font-size: 0.82rem;
        }
      }
    }

    .section-header {
      .header-icon {
        width: 40px;
        height: 40px;
      }

      h2 {
        font-size: 1.15rem;
      }

      .subtitle {
        font-size: 0.78rem;
      }
    }

    .config-card,
    .history-section,
    .consult-section,
    .session-section {
      .card-header h4 {
        font-size: 0.95rem;
      }
    }

    .analysis-card {
      padding: 14px;

      h5 {
        font-size: 0.88rem;
      }
    }

    .flashcard {
      height: 250px;
    }

    .flashcard-face {
      padding: 18px;

      .card-face-label {
        font-size: 0.62rem;
      }

      .card-aa-badge {
        font-size: 0.62rem;
      }
    }

    .card-text {
      font-size: 0.9rem;
    }

    .flip-hint {
      font-size: 0.72rem;
    }

    .empty-state {
      padding: 32px 16px;

      p {
        font-size: 0.85rem;
      }
    }

    .generating-state {
      min-height: 260px;
    }

    .generating-content {
      padding: 24px 14px;

      h3 {
        font-size: 1.1rem;
      }
    }

    .complete-card {
      padding: 22px 14px;

      h3 {
        font-size: 1.15rem;
      }

      .complete-icon {
        width: 56px;
        height: 56px;
      }
    }

    .complete-stats .stat-item {
      min-width: 70px;

      .stat-number {
        font-size: 1.3rem;
      }

      .stat-label {
        font-size: 0.68rem;
      }
    }

    .history-card {
      .card-actions-row {
        flex-direction: column;
        gap: 6px;

        .btn-card-action {
          width: 100%;
          text-align: center;
        }
      }
    }

    .btn-generate,
    .btn-review-start,
    .btn-back {
      font-size: 0.82rem;
      padding: 10px 16px;
    }
  }
}

@media (max-width: 480px) {
  .flashcards-page {
    .flashcard {
      height: 220px;
    }

    .flashcard-face {
      padding: 14px;
    }

    .card-text {
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .stats-overview-grid {
      grid-template-columns: 1fr;
    }

    .consult-subtabs {
      .subtab-btn {
        padding: 7px 10px;
        font-size: 0.72rem;
      }
    }
  }
}
"""
with open("/home/oussemabenelhaj/Documents/GitHub/stage/frontend/src/app/demo/pages/flashcards/flashcards.component.scss", "a") as f:
    f.write(content)
