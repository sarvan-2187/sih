export type OutputType =
  | 'video' | 'audio' | 'mindmap' | 'flashcards' | 'briefing' | 'study_guide' | 'blog_post' | 'slides' | 'animation';
export type SourceKind = 'pdf' | 'text';
export type SourceStatus = 'pending' | 'confirmed';

export interface StudySpaceSummary {
  id: string;
  title: string;
  source_count: number;
  output_count: number;
  updated_at: string;
}

export interface StudySpace {
  id: string;
  owner_uid: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export type SourceRagStatus = 'not_indexed' | 'processing' | 'ready' | 'failed';

export interface Source {
  id: string;
  study_space_id: string;
  owner_uid: string;
  kind: SourceKind;
  filename: string | null;
  status: SourceStatus;
  created_at: string;
  // Q&A indexing state — independent of `status` above, which only tracks the
  // upload-confirmation / grounding-text flow every other output already uses.
  // See PLANS/qstudio-rag.md.
  rag_status: SourceRagStatus;
  rag_error: string | null;
  chunk_count: number;
}

// --- Source-grounded Q&A (RAG) ---

export interface RagCitation {
  citation_id: string;
  source_id: string;
  source_name: string;
  page: number | null;
  section: string | null;
  chunk_id: string;
  snippet: string;
}

export interface RagRetrievalMeta {
  chunks_used: number;
  retrieval_ms: number;
  rerank_ms: number;
  generation_ms: number;
  total_ms: number;
}

export interface RagQueryResponse {
  answer: string;
  insufficient_evidence: boolean;
  citations: RagCitation[];
  retrieval: RagRetrievalMeta;
}

export interface RagMessage {
  id: string;
  study_space_id: string;
  owner_uid: string;
  role: 'user' | 'assistant';
  content: string;
  citations: RagCitation[];
  created_at: string;
}

export interface SourceRagStatusOut {
  rag_status: SourceRagStatus;
  rag_error: string | null;
  chunk_count: number;
}

export interface SourceUploadUrlResponse {
  upload_url: string;
  source_id: string;
}

export interface MindMapNode {
  label: string;
  children: MindMapNode[];
}

export interface MindMapResult {
  root: MindMapNode;
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardsResult {
  cards: FlashcardItem[];
}

export interface BriefingTopic {
  title: string;
  summary: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface BriefingResult {
  overview: string;
  key_topics: BriefingTopic[];
  glossary: GlossaryTerm[];
}

export interface StudyGuideQuestion {
  question: string;
  answer: string;
}

export interface StudyGuideResult {
  short_answer_questions: StudyGuideQuestion[];
  essay_questions: string[];
  glossary: GlossaryTerm[];
}

export interface BlogSection {
  heading: string;
  body: string;
}

export interface BlogPostResult {
  title: string;
  intro: string;
  sections: BlogSection[];
  conclusion: string;
}

export interface VideoOverviewPointerResult {
  video_overview_id: string;
}

export type VoiceKey = 'jenny' | 'aria' | 'guy' | 'davis' | 'sonia' | 'ryan';

export const VOICE_OPTIONS: { value: VoiceKey; label: string }[] = [
  { value: 'jenny', label: 'Jenny (US, female)' },
  { value: 'aria', label: 'Aria (US, female)' },
  // Underlying key/voice id stays 'guy' / en-US-GuyNeural (edge_tts's own voice name) —
  // "James" is just the display name shown to users and used as this host's name.
  { value: 'guy', label: 'James (US, male)' },
  { value: 'davis', label: 'Davis (US, male)' },
  { value: 'sonia', label: 'Sonia (UK, female)' },
  { value: 'ryan', label: 'Ryan (UK, male)' },
];

export interface AudioOverviewResult {
  b2_key: string;
  duration_seconds: number;
  voice_a: VoiceKey;
  voice_b: VoiceKey;
}

export type SlideTheme = 'minimal_dark' | 'bold_gradient' | 'academic_light';

export const SLIDE_THEME_OPTIONS: { value: SlideTheme; label: string; description: string }[] = [
  { value: 'minimal_dark', label: 'Minimal Dark', description: 'Sleek black theme' },
  { value: 'bold_gradient', label: 'Bold Gradient', description: 'Vibrant colorful theme' },
  { value: 'academic_light', label: 'Academic Light', description: 'Clean lecture-note theme' },
];

export type SlideLayout = 'title' | 'section' | 'bullets' | 'quote' | 'comparison' | 'stat';

export interface SlideStat {
  value: string;
  label: string;
}

export interface Slide {
  layout: SlideLayout;
  title: string | null;
  subtitle: string | null;
  bullets: string[];
  quote: string | null;
  attribution: string | null;
  left_label: string | null;
  left_points: string[];
  right_label: string | null;
  right_points: string[];
  stats: SlideStat[];
}

export interface SlidesResult {
  slides: Slide[];
  slide_images: string[];
  pdf_b2_key: string;
  theme: SlideTheme;
}

// Single-narrator only (VoiceGender, same binary Video Overview uses) — not
// AudioOverview's 6-voice VOICE_OPTIONS catalog, since Animation has one
// narrator, not two hosts. See PLANS/qstudio-animation.md §3/§7.
export interface AnimationResult {
  b2_key: string;
  thumbnail_b2_key: string | null;
  duration_seconds: number;
  // null means a silent animation — no narration was generated. See
  // qstudio_service/pipeline_manim.py::run_animation_pipeline.
  voice: 'female' | 'male' | null;
  // Absent on animations rendered before theming shipped.
  theme?: SlideTheme;
}

export interface Output {
  id: string;
  // null for qCompare-triggered audio/animation outputs (routers/qroute_router.py) —
  // every ordinary QStudio output still always has a real study space.
  study_space_id: string | null;
  owner_uid: string;
  type: OutputType;
  params: Record<string, unknown>;
  status: 'generating' | 'ready' | 'failed';
  error: string | null;
  result:
    | MindMapResult
    | FlashcardsResult
    | BriefingResult
    | StudyGuideResult
    | BlogPostResult
    | VideoOverviewPointerResult
    | AudioOverviewResult
    | SlidesResult
    | AnimationResult
    | Record<string, unknown>;
  created_at: string;
  updated_at: string;
  qcompare_job_id: string | null;
}

export interface FlashcardReviewResult {
  xp_awarded: number;
  next_review_date: string;
  ease_factor: number;
  interval_days: number;
  new_badges: unknown[];
}

// Output types with a generation handler wired up — see PLANS/qstudio.md and
// PLANS/qstudio-animation.md.
export const IMPLEMENTED_OUTPUT_TYPES: OutputType[] = [
  'mindmap', 'flashcards', 'briefing', 'study_guide', 'blog_post', 'video', 'audio', 'slides', 'animation',
];

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  video: 'Video Overview',
  audio: 'Audio Overview',
  mindmap: 'Mind Map',
  flashcards: 'Flashcards',
  briefing: 'Briefing Doc',
  study_guide: 'Study Guide',
  blog_post: 'Blog Post',
  slides: 'Slides',
  animation: 'Animation',
};
