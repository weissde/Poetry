from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    poemId: str | None = None
    poemTitle: str | None = None
    poemAuthor: str | None = None
    poemContent: str
    depth: Literal['lite', 'standard', 'exam'] = 'standard'


class ChatMessage(BaseModel):
    role: Literal['user', 'assistant']
    content: str


class ChatRequest(BaseModel):
    mode: Literal['qa', 'poet'] = 'qa'
    poet: str = 'libai'
    poemContext: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)
    userMessage: str


class ChatSummarySaveRequest(BaseModel):
    mode: Literal['qa', 'poet'] = 'qa'
    poet: str = 'libai'
    poemTitle: str | None = None
    poemAuthor: str | None = None
    poemContext: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    forceAi: bool = False


class QuestionGenerateRequest(BaseModel):
    topic: str
    count: int = Field(default=5, ge=3, le=20)
    difficulty: Literal['easy', 'medium', 'hard'] = 'medium'
    types: list[Literal['memorization', 'meaning', 'technique', 'emotion', 'appreciation', 'comparison', 'context']] = Field(
        default_factory=list
    )


class WrongbookSubjectivePracticeGenerateRequest(BaseModel):
    count: int = Field(default=8, ge=3, le=20)
    difficulty: Literal['easy', 'medium', 'hard'] = 'medium'
    status: Literal['pending', 'retry', 'all'] = 'pending'
    dynasty: str | None = None
    theme: str | None = None
    keywordTag: str | None = None


class PracticeAnswerSubmitRequest(BaseModel):
    questionType: str
    isCorrect: bool
    dynasty: str | None = None
    theme: str | None = None
    keywordTags: list[str] = Field(default_factory=list)
    questionSource: str | None = None


class PracticeSessionTypeStat(BaseModel):
    type: str
    attempts: int = Field(default=0, ge=0)
    correct: int = Field(default=0, ge=0)
    rate: int = Field(default=0, ge=0, le=100)


class PracticeSessionSummarySaveRequest(BaseModel):
    source: str = 'practice'
    topic: str | None = None
    summary: str
    attempts: int = Field(default=0, ge=0)
    correct: int = Field(default=0, ge=0)
    accuracy: int = Field(default=0, ge=0, le=100)
    weakType: str | None = None
    typeStats: list[PracticeSessionTypeStat] = Field(default_factory=list)


class PracticeQuestionFeedbackRequest(BaseModel):
    topic: str | None = None
    questionType: str | None = None
    questionContent: str
    options: list[str] = Field(default_factory=list)
    selectedIndex: int | None = None
    correctIndex: int | None = None
    comment: str = Field(default='', max_length=500)
    source: str | None = None


class WrongbookItemIn(BaseModel):
    questionId: str | None = None
    poemTitle: str
    questionContent: str
    userAnswer: str
    correctAnswer: str
    explanation: str
    errorType: str | None = None
    dynasty: str | None = None
    theme: str | None = None
    questionKind: str | None = None
    keywordTags: list[str] = Field(default_factory=list)
    status: str = 'pending'


class WrongbookStatusUpdate(BaseModel):
    status: Literal['pending', 'mastered', 'retry']


class WrongbookBatchUpdate(BaseModel):
    ids: list[str] = Field(default_factory=list)
    action: Literal['set_status', 'delete']
    status: Literal['pending', 'mastered', 'retry'] | None = None


class ReviewPlanRequest(BaseModel):
    examDate: str | None = None


class ReviewPlanTaskUpdate(BaseModel):
    key: str
    done: bool


class ReviewPlanTaskReorder(BaseModel):
    dayIndex: int = Field(ge=0)
    fromIndex: int = Field(ge=0)
    toIndex: int = Field(ge=0)


class ReviewPlanTaskMove(BaseModel):
    fromDayIndex: int = Field(ge=0)
    fromIndex: int = Field(ge=0)
    toDayIndex: int = Field(ge=0)
    toIndex: int = Field(ge=0)


class ExamCreateRequest(BaseModel):
    mode: Literal['zhongkao', 'gaokao', 'custom'] = 'zhongkao'
    topic: str
    count: int = 10
    durationMinutes: int | None = Field(default=None, ge=10, le=180)
    templateId: str | None = None
    subjectiveRatio: float | None = Field(default=None, ge=0, le=1)
    subjectiveCount: int | None = Field(default=None, ge=0, le=20)


class ExamSubmitRequest(BaseModel):
    mode: str
    topic: str | None = None
    questions: list[dict[str, Any]]
    answers: list[int | str | None]


class CreationReviewRequest(BaseModel):
    style: str = '豪放'
    referencePoem: str | None = None
    content: str


class CreationRefineRequest(BaseModel):
    instruction: str | None = None
    style: str | None = None
    referencePoem: str | None = None


class CreationTransformRequest(BaseModel):
    style: str = '豪放'
    referencePoem: str | None = None
    modernText: str


class CreationVisibilityUpdateRequest(BaseModel):
    isPublic: bool


class CreationLikeUpdateRequest(BaseModel):
    liked: bool = True


class MemoryEnrollRequest(BaseModel):
    poemId: str


class MemoryReviewSubmitRequest(BaseModel):
    memoryId: str | None = None
    poemId: str | None = None
    quality: int = Field(default=3, ge=0, le=5)
    isCorrect: bool | None = None
    mode: Literal['blank', 'next_line', 'dictation', 'full_text', 'self_check'] = 'self_check'
    timeSpent: int | None = Field(default=None, ge=0, le=7200)


class PoemFavoriteUpdateRequest(BaseModel):
    favorited: bool = True


class PoemNoteUpsertRequest(BaseModel):
    note: str = Field(default='', max_length=4000)


class UserRoleUpdateRequest(BaseModel):
    role: Literal['student', 'teacher'] = 'student'


class TeachingSessionCreateRequest(BaseModel):
    poemId: str | None = None
    poemTitle: str | None = Field(default=None, max_length=200)
    poemAuthor: str | None = Field(default=None, max_length=120)
    unitId: str | None = None
    currentStep: int = Field(default=0, ge=0, le=6)
    notes: str | None = Field(default=None, max_length=4000)


class TeachingSessionStepUpdateRequest(BaseModel):
    currentStep: int = Field(ge=0, le=6)
    poemId: str | None = None
    poemTitle: str | None = Field(default=None, max_length=200)
    poemAuthor: str | None = Field(default=None, max_length=120)
    unitId: str | None = None
    notes: str | None = Field(default=None, max_length=4000)


class TeachingSessionEndRequest(BaseModel):
    notes: str | None = Field(default=None, max_length=4000)


class LearningReportRequest(BaseModel):
    targetUserId: str | None = None


class LessonTaskCreateRequest(BaseModel):
    targetUserId: str | None = None
    poemId: str | None = None
    title: str = Field(min_length=1, max_length=200)
    detail: str | None = Field(default=None, max_length=2000)
    taskType: Literal['practice', 'memory', 'exam', 'review', 'learn', 'custom'] = 'practice'
    status: Literal['pending', 'in_progress', 'completed', 'assigned'] = 'pending'
    to: str | None = Field(default=None, max_length=500)
    dueDate: str | None = None


class LessonTaskStatusUpdateRequest(BaseModel):
    status: Literal['pending', 'in_progress', 'completed', 'assigned']


class TeachingUnitCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, max_length=500)
    category: Literal['theme', 'dynasty', 'grade'] = 'theme'
    gradeLevel: list[Literal['primary', 'middle', 'high']] = Field(default_factory=list)
    poemIds: list[str] = Field(default_factory=list, max_length=100)
    curriculumRef: str | None = Field(default=None, max_length=200)
    masteryTarget: int = Field(default=80, ge=0, le=100)
    displayOrder: int = Field(default=0, ge=0, le=9999)
    isActive: bool = True


class TeachingUnitUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, max_length=500)
    category: Literal['theme', 'dynasty', 'grade'] | None = None
    gradeLevel: list[Literal['primary', 'middle', 'high']] | None = None
    poemIds: list[str] | None = Field(default=None, max_length=100)
    curriculumRef: str | None = Field(default=None, max_length=200)
    masteryTarget: int | None = Field(default=None, ge=0, le=100)
    displayOrder: int | None = Field(default=None, ge=0, le=9999)
    isActive: bool | None = None


class TeachingUnitPoemsUpdateRequest(BaseModel):
    poemIds: list[str] = Field(default_factory=list, max_length=200)


class PoemExamPointsUpsertRequest(BaseModel):
    examPoints: list[dict[str, str]] = Field(default_factory=list, max_length=20)


class PoemExamPointCreateRequest(BaseModel):
    pointType: str = Field(default='考点', min_length=1, max_length=40)
    content: str = Field(min_length=1, max_length=500)


class NoteCreateRequest(BaseModel):
    poemId: str
    note: str = Field(default='', max_length=4000)


class NoteUpdateRequest(BaseModel):
    note: str = Field(default='', max_length=4000)


class ClassCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class ClassUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class ClassJoinRequest(BaseModel):
    inviteCode: str = Field(min_length=6, max_length=12)
