/// <reference types="react" />
import type { QueueAPI } from './types';
import type { EffectsEmitter } from '../emitter';
export declare const EffectsContext: import("react").Context<EffectsEmitter<import("boardgame.io").State<any, import("boardgame.io").Ctx> & {
    isActive: boolean;
    isConnected: boolean;
    log: import("boardgame.io").LogEntry[];
} & Omit<import("boardgame.io/dist/types/src/client/react").WrappedBoardProps, "playerID" | "matchID" | "log" | "moves" | "events" | "reset" | "undo" | "redo" | "matchData" | "sendChatMessage" | "chatMessages"> & {
    playerID: string | null;
    matchID: string;
    log: import("boardgame.io").LogEntry[] | undefined;
    moves: Record<string, (...args: any[]) => void>;
    events: {
        endGame?: ((gameover?: any) => void) | undefined;
        endPhase?: (() => void) | undefined;
        endTurn?: ((arg?: {
            next: string;
        } | undefined) => void) | undefined;
        setPhase?: ((newPhase: string) => void) | undefined;
        endStage?: (() => void) | undefined;
        setStage?: ((newStage: string) => void) | undefined;
        setActivePlayers?: ((arg: import("boardgame.io").ActivePlayersArg) => void) | undefined;
    };
    reset: () => void;
    undo: () => void;
    redo: () => void;
    matchData?: import("boardgame.io").FilteredMetadata | undefined;
    sendChatMessage: (message: any) => void;
    chatMessages: import("boardgame.io").ChatMessage[];
} & {
    isMultiplayer: boolean;
}> | null>;
export declare const EffectsQueueContext: import("react").Context<QueueAPI | undefined>;
export declare const EffectsPropsContext: import("react").Context<(import("boardgame.io").State<any, import("boardgame.io").Ctx> & {
    isActive: boolean;
    isConnected: boolean;
    log: import("boardgame.io").LogEntry[];
} & Omit<import("boardgame.io/dist/types/src/client/react").WrappedBoardProps, "playerID" | "matchID" | "log" | "moves" | "events" | "reset" | "undo" | "redo" | "matchData" | "sendChatMessage" | "chatMessages"> & {
    playerID: string | null;
    matchID: string;
    log: import("boardgame.io").LogEntry[] | undefined;
    moves: Record<string, (...args: any[]) => void>;
    events: {
        endGame?: ((gameover?: any) => void) | undefined;
        endPhase?: (() => void) | undefined;
        endTurn?: ((arg?: {
            next: string;
        } | undefined) => void) | undefined;
        setPhase?: ((newPhase: string) => void) | undefined;
        endStage?: (() => void) | undefined;
        setStage?: ((newStage: string) => void) | undefined;
        setActivePlayers?: ((arg: import("boardgame.io").ActivePlayersArg) => void) | undefined;
    };
    reset: () => void;
    undo: () => void;
    redo: () => void;
    matchData?: import("boardgame.io").FilteredMetadata | undefined;
    sendChatMessage: (message: any) => void;
    chatMessages: import("boardgame.io").ChatMessage[];
} & {
    isMultiplayer: boolean;
}) | undefined>;
