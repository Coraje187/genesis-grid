import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBoardData {
  id: string;
  title: string;
  columns: KanbanColumn[];
}

export default function KanbanBoard() {
  const [boards, setBoards] = useState<KanbanBoardData[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ boardId: string, colId: string, cardId: string } | null>(null);

  useEffect(() => {
    invoke<string>("load_kanban_config")
      .then((json) => {
        let loaded: KanbanBoardData[] = JSON.parse(json);
        if (loaded.length === 0) {
          // Default initial board
          loaded = [{
            id: "board-" + Date.now(),
            title: "Project Master Plan",
            columns: [
              { id: "col-todo", title: "To Do", cards: [] },
              { id: "col-inprog", title: "In Progress", cards: [] },
              { id: "col-done", title: "Done", cards: [] }
            ]
          }];
          invoke("save_kanban_config", { content: JSON.stringify(loaded) }).catch(console.error);
        }
        setBoards(loaded);
        setActiveBoardId(loaded[0].id);
      })
      .catch((err) => {
        console.error("Failed to load kanban config", err);
      });
  }, []);

  const saveState = (newState: KanbanBoardData[]) => {
    setBoards(newState);
    invoke("save_kanban_config", { content: JSON.stringify(newState) }).catch(console.error);
  };

  const handleDragStart = (e: React.DragEvent, boardId: string, colId: string, cardId: string) => {
    setDraggedCard({ boardId, colId, cardId });
    // Make it look a bit transparent while dragging
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    setDraggedCard(null);
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedCard || !activeBoardId) return;
    if (draggedCard.colId === targetColId) return; // Dropped in same column

    const boardIndex = boards.findIndex(b => b.id === activeBoardId);
    if (boardIndex === -1) return;

    const newBoards = [...boards];
    const board = { ...newBoards[boardIndex] };
    const sourceColIndex = board.columns.findIndex(c => c.id === draggedCard.colId);
    const targetColIndex = board.columns.findIndex(c => c.id === targetColId);

    if (sourceColIndex === -1 || targetColIndex === -1) return;

    const sourceCol = { ...board.columns[sourceColIndex], cards: [...board.columns[sourceColIndex].cards] };
    const targetCol = { ...board.columns[targetColIndex], cards: [...board.columns[targetColIndex].cards] };

    const cardIndex = sourceCol.cards.findIndex(c => c.id === draggedCard.cardId);
    if (cardIndex === -1) return;

    const [card] = sourceCol.cards.splice(cardIndex, 1);
    targetCol.cards.push(card);

    board.columns[sourceColIndex] = sourceCol;
    board.columns[targetColIndex] = targetCol;
    newBoards[boardIndex] = board;

    saveState(newBoards);
  };

  const handleAddCard = (colId: string) => {
    const title = prompt("Task title:");
    if (!title) return;
    const desc = prompt("Description (optional):") || "";

    const boardIndex = boards.findIndex(b => b.id === activeBoardId);
    if (boardIndex === -1) return;

    const newBoards = [...boards];
    const board = { ...newBoards[boardIndex] };
    const colIndex = board.columns.findIndex(c => c.id === colId);
    
    const newCol = { ...board.columns[colIndex], cards: [...board.columns[colIndex].cards] };
    newCol.cards.push({ id: "card-" + Date.now(), title, description: desc });
    board.columns[colIndex] = newCol;
    newBoards[boardIndex] = board;

    saveState(newBoards);
  };

  const handleDeleteCard = (colId: string, cardId: string) => {
    const boardIndex = boards.findIndex(b => b.id === activeBoardId);
    if (boardIndex === -1) return;

    const newBoards = [...boards];
    const board = { ...newBoards[boardIndex] };
    const colIndex = board.columns.findIndex(c => c.id === colId);
    
    const newCol = { ...board.columns[colIndex], cards: board.columns[colIndex].cards.filter(c => c.id !== cardId) };
    board.columns[colIndex] = newCol;
    newBoards[boardIndex] = board;

    saveState(newBoards);
  };

  const activeBoard = boards.find(b => b.id === activeBoardId);

  return (
    <div className="view-container kanban-view">
      <div style={{ padding: "20px 30px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{activeBoard?.title || "Kanban Board"}</h2>
        <div style={{ color: "var(--ink-soft)" }}>Drag and Drop to Organize</div>
      </div>
      
      <div style={{ display: "flex", gap: "20px", padding: "20px 30px", height: "calc(100vh - 80px)", overflowX: "auto" }}>
        {activeBoard?.columns.map(col => (
          <div 
            key={col.id}
            className="cyber-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col.id)}
            style={{
              flex: "0 0 320px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="cyber-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)" }}>{col.title} <span style={{fontSize: "12px", background: "var(--bg-raised)", border: "1px solid var(--accent)", color: "var(--accent)", padding: "2px 8px", borderRadius: "10px", marginLeft: "8px"}}>{col.cards.length}</span></h3>
              <button 
                onClick={() => handleAddCard(col.id)}
                style={{ background: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "20px", textShadow: "var(--glow-cyan)" }}
              >
                +
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", padding: "16px" }}>
              {col.cards.map(card => (
                <div
                  key={card.id}
                  className="cyber-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, activeBoard.id, col.id, card.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    background: "var(--bg)",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    cursor: "grab",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    position: "relative"
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--ink)", paddingRight: "20px" }}>{card.title}</div>
                  {card.description && <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{card.description}</div>}
                  <button 
                    onClick={() => handleDeleteCard(col.id, card.id)}
                    style={{ position: "absolute", top: "12px", right: "12px", background: "transparent", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: "16px" }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
