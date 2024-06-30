import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { PrematchBoard } from './prematchBoard';
import { prematch } from './prematch';
import settings from '../../package.json';

export const PrematchApp = Client({ 
    game: prematch,
    board: PrematchBoard,
    debug: false,
    multiplayer: SocketIO({ server: settings.ip + ':8000' })
});