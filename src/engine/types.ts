export type Mode = 'time' | 'words' | 'custom';

/** One word of the target text plus what has to be typed after it. */
export interface WordSlot {
  text: string;
  /** Separator expected after the word. '' marks the last word of a finite test. */
  sep: ' ' | '\n' | '';
  /** Visual indentation (in characters) before the word. Skipped automatically, never typed. */
  indent: number;
}

export interface Sample {
  /** Second of the test this sample closes (may be fractional for the last one). */
  t: number;
  /** Net ppm accumulated until `t`. */
  net: number;
  /** Raw ppm typed during this second. */
  raw: number;
  /** Mistakes made during this second. */
  errors: number;
}

export interface CharCounts {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export interface TestResult {
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  chars: CharCounts;
  duration: number;
  samples: Sample[];
}
