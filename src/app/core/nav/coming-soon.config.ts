import { ComingSoonInfo } from '../../shared/components/coming-soon/coming-soon.model';

/** Content for every module that is still a placeholder. Delete an entry (and its route) when the real page ships. */
export const COMING_SOON = {
  institutes: {
    title: 'Institute Management', icon: 'bi-bank',
    summary: 'Maintain the colleges on the programme and the batches that run in them.',
    features: ['Institute profiles with principal and contact details', 'Create and track batches per institute', 'See enrolled students at a glance'],
  },
  courseAssignments: {
    title: 'Assignments', icon: 'bi-journal-text',
    summary: 'Set assignments for course modules and review submissions.',
    features: ['Create assignments with due dates', 'Collect and grade submissions', 'Feedback per student'],
  },
  courseAssessments: {
    title: 'Assessments', icon: 'bi-patch-check',
    summary: 'Plan and run assessments across a course.',
    features: ['Assessments with pass marks', 'Schedule per batch', 'Result reports per student and batch'],
  },
  courseQuizzes: {
    title: 'Quiz', icon: 'bi-question-circle',
    summary: 'Build quizzes from a reusable question bank.',
    features: ['Question bank with reusable groups', 'Pass marks and attempt limits', 'Quiz results per student'],
  },
  enrollment: {
    title: 'Enrollment', icon: 'bi-person-plus',
    summary: 'Put students into courses and batches without the paperwork.',
    features: ['Enrol individual students or whole batches', 'Assign mentors to groups', 'Track enrolment status and history'],
  },
  assessments: {
    title: 'Quiz, Assignment & Assessments', icon: 'bi-patch-check',
    summary: 'Build question banks and set quizzes and assignments for each module.',
    features: ['Question bank with reusable groups', 'Quizzes with pass marks and attempt limits', 'Result reports per student and batch'],
  },
  community: {
    title: 'SHARP Community', icon: 'bi-chat-dots',
    summary: 'A shared floor and group chats for students, mentors and the programme team.',
    features: ['Create discussion groups and pick members', 'Moderate the common floor', 'Announcements to everyone or to a group'],
  },
  studentDashboard: {
    title: 'Dashboard', icon: 'bi-grid-fill',
    summary: 'Your programme at a glance: progress, attendance and what is due next.',
    features: ['Course progress and next module', 'Attendance summary', 'Upcoming sessions and deadlines'],
  },
  studentLearning: {
    title: 'My Learning', icon: 'bi-journal-richtext',
    summary: 'Work through your course modules, materials and quizzes.',
    features: ['Chapters and lessons with videos and documents', 'Module quizzes that unlock the next step', 'Resume exactly where you left off'],
  },
  studentAssessments: {
    title: 'Assessments', icon: 'bi-patch-check',
    summary: 'Take quizzes and submit assignments, then see how you did.',
    features: ['Quizzes and assignments assigned to you', 'Scores and feedback', 'Retake where your mentor allows'],
  },
} as const satisfies Record<string, ComingSoonInfo>;
