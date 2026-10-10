// The admin v2's shared building blocks (every view uses them): the shirt, pegs, rails and the peg wall,
// the LED scoreboard, the V/E/D mark, the cromo and the lower third.
export { Peg, PegRail, PegWall, ShirtBack, Stickers, type PegProps, type ShirtState, type Sticker } from "./ShirtBack";
export { pegsPerRail, railsOf } from "./wall";
export { LedBoard, type LedBoardProps, type LedFlash } from "./LedBoard";
export { ResultMark } from "./ResultMark";
export { resultLetter, resultWord, type ResultLetter } from "./result";
export { CromoCard, CromoNew, type CromoViewProps } from "./Cromo";
export { LowerThird, type LowerThirdProps } from "./LowerThird";
