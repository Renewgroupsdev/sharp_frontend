import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../shared/components/local-list-base';
import { ActivityLogService } from '../../shared/common-services/activity-log.service';
import { CoursesService } from '../../shared/common-services/courses.service';
import { BatchesService } from '../../shared/common-services/batches.service';
import { UsersService } from '../../shared/common-services/users.service';
import { EnrollmentService } from '../../shared/common-services/enrollment.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { RibbonItem, ExportFormat, QuickAction, TableColumn, TableRow } from '../../shared/models/common-components.model';
import { COURSE_STATUSES, Course, lessonsOf } from '../../shared/models/course.model';
import { CategoryForm } from './category-form/category-form';
import { CategoryView } from './category-view/category-view';
import { CourseForm } from './course-form/course-form';
import { CourseModulesDialog } from './course-modules/course-modules-dialog';
import { CourseStudents } from './course-students/course-students';
import { CourseInvite } from './course-students/course-invite';
import { CourseView } from './course-view/course-view';

type CourseTab = 'courses' | 'categories' | 'trash';

const COURSE_COLUMNS: TableColumn[] = [
  { key: 'course', header: 'Course', type: 'lead', width: '17%', minWidth: 170 },
  { key: 'category', header: 'Category', width: '8%' },
  { key: 'mentor', header: 'Mentor', width: '10%' },
  { key: 'batches', header: 'Batches', type: 'countList', width: '8%' },
  { key: 'delivery', header: 'Delivery', width: '9%' },
  { key: 'duration', header: 'Duration', width: '6%' },
  { key: 'content', header: 'Content', width: '10%' },
  { key: 'students', header: 'Students', type: 'countList', width: '6%' },
  { key: 'scope', header: 'Scope', width: '6%' },
  { key: 'status', header: 'Status', type: 'badge', width: '7%' },
  { key: 'actions', header: 'Actions', type: 'quickActions', menu: true, width: '6%', sortable: false },
];

const CATEGORY_COLUMNS: TableColumn[] = [
  { key: 'category', header: 'Category', type: 'lead', width: '22%' },
  { key: 'desc', header: 'Description', width: '40%' },
  { key: 'courses', header: 'Courses', width: '10%' },
  { key: 'status', header: 'Status', type: 'toggle', width: '10%' },
  { key: 'actions', header: 'Actions', type: 'quickActions', menu: true, width: '10%', sortable: false },
];

const TRASH_COLUMNS: TableColumn[] = [
  { key: 'course', header: 'Course', type: 'lead', width: '30%' },
  { key: 'category', header: 'Category', width: '20%' },
  { key: 'deletedOn', header: 'Deleted on', width: '20%' },
  { key: 'actions', header: 'Actions', type: 'quickActions', menu: true, width: '12%', sortable: false },
];

/** Course Management: courses, the category list and the trash of deleted courses. */
@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [MatDialogModule, CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective],
  templateUrl: './courses.html',
  styleUrls: ['../../shared/styles/erp-page.scss'],
})
export class Courses extends LocalListBase implements OnInit {
  private readonly store = inject(CoursesService);
  private readonly enrollments = inject(EnrollmentService);
  private readonly batchStore = inject(BatchesService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  protected readonly noun = 'courses';
  protected override filterFields = { status: 'status', source: 'category', branch: ['name'] };

  readonly tab = signal<CourseTab>('courses');

  ngOnInit(): void {
    this.store.loadFromApi().catch(e => this.toast.error('Could not load courses', apiErrorMessage(e)));
    // Enrolled students are the students of the course's batches.
    this.batchStore.loadBatches().catch(() => undefined);
    void this.users.refresh();
  }

  override columns: TableColumn[] = COURSE_COLUMNS;
  override filters = [
    { key: 'status', label: 'Status', options: [...COURSE_STATUSES] as string[] },
    { key: 'source', label: 'Category', options: this.store.categories.items().map(k => k.n) },
  ];

  readonly tabs = computed(() => [
    { key: 'courses' as const, label: `Courses (${this.store.live().length})` },
    { key: 'categories' as const, label: `Category list (${this.store.categories.items().length})` },
    { key: 'trash' as const, label: `Deleted (${this.store.items().length - this.store.live().length})` },
  ]);

  readonly stats = computed<RibbonItem[]>(() => {
    const live = this.store.live();
    return [
      { label: 'Courses', value: live.length, icon: 'bi-journal-bookmark', iconVariant: 'blue' },
      { label: 'Published', value: live.filter(c => c.status === 'Published').length, icon: 'bi-check-circle-fill', iconVariant: 'green', filter: { key: 'status', value: 'Published' } },
      { label: 'Categories', value: this.store.categories.items().length, icon: 'bi-tags-fill', iconVariant: 'purple' },
      { label: 'Lessons', value: live.reduce((a, c) => a + lessonsOf(c).length, 0), icon: 'bi-play-circle-fill', iconVariant: 'orange' },
    ];
  });

  readonly title = computed(() => ({ courses: 'Courses', categories: 'Course categories', trash: 'Deleted courses' })[this.tab()]);

  setTab(tab: CourseTab): void {
    this.tab.set(tab);
    this.columns = { courses: COURSE_COLUMNS, categories: CATEGORY_COLUMNS, trash: TRASH_COLUMNS }[tab];
    this.filters = tab === 'courses'
      ? [{ key: 'status', label: 'Status', options: [...COURSE_STATUSES] }, { key: 'source', label: 'Category', options: this.store.categories.items().map(k => k.n) }]
      : [];
    this.searchTerm = '';
    this.filterState = { status: null, source: null, branch: [], telecaller: null, dateFrom: null, dateTo: null };
    this.currentPage = 1;
    this.refresh();
  }

  get searchPlaceholder(): string {
    return this.tab() === 'courses' ? 'Search by title, ID, mentor or category...' : 'Search...';
  }

  protected allRows(): TableRow[] {
    const tab = this.tab();
    if (tab === 'categories') return this.categoryRows();
    return this.store.items().filter(c => c.deleted === (tab === 'trash')).map(c => (tab === 'trash' ? this.trashRow(c) : this.courseRow(c)));
  }

  private courseRow(c: Course): TableRow {
    const lessons = lessonsOf(c).length;
    const students = this.enrollments.forCourse(c.title).map(e => `${e.name} (${e.sid})`);
    const act = (key: string, icon: string, label: string, permission: string, variant?: QuickAction['variant']): QuickAction => ({ key, icon, label, permission, variant });
    return {
      id: c.id,
      course: { name: c.title, subtitle: c.code ?? c.id, photo: c.thumb },
      __course: c.title,
      searchText: `${c.title} ${c.code ?? c.id} ${c.trainer} ${c.category} ${c.batches.join(' ')}`,
      category: c.category,
      mentor: c.trainer || 'Unassigned',
      batches: c.batches, __batches: c.batches.length,
      delivery: `${c.mode} · ${c.level}`,
      duration: `${c.hours} h`, __duration: c.hours,
      content: `${c.chapters.length} ch · ${lessons} lessons`,
      students, __students: students.length,
      scope: c.scope,
      status: c.status,
      actions: [
        act('front', 'bi-window-desktop', 'Frontend view', 'a_courses.view'),
        act('mods', 'bi-list-nested', 'Modules / topics', 'a_courses.view'),
        act('students', 'bi-people-fill', 'Students', 'a_courses.view'),
        act('invite', 'bi-envelope-paper-fill', 'Invite', 'a_courses.edit'),
        act('view', 'bi-eye-fill', 'View course', 'a_courses.view'),
        act('edit', 'bi-pencil-square', 'Edit course', 'a_courses.edit', 'primary'),
        act('delete', 'bi-trash3-fill', 'Delete course', 'a_courses.delete', 'danger'),
      ],
    };
  }

  private categoryRows(): TableRow[] {
    return this.store.categories.items().map(k => ({
      id: k.id,
      category: { name: k.n, subtitle: k.id },
      __category: k.n,
      __name: k.n,
      searchText: `${k.n} ${k.id} ${k.desc}`,
      desc: k.desc,
      courses: String(this.store.categoryUse(k.n)), __courses: this.store.categoryUse(k.n),
      status: k.st,
      actions: [
        { key: 'edit', icon: 'bi-pencil-square', label: 'Edit category', variant: 'primary', permission: 'a_courses.edit' },
        { key: 'delete', icon: 'bi-trash3-fill', label: 'Delete category', variant: 'danger', permission: 'a_courses.delete' },
      ] as QuickAction[],
    }));
  }

  private trashRow(c: Course): TableRow {
    return {
      id: c.id,
      course: { name: c.title, subtitle: c.id },
      __course: c.title,
      searchText: `${c.title} ${c.id}`,
      category: c.category,
      deletedOn: c.deletedOn ?? '',
      actions: [
        { key: 'restore', icon: 'bi-arrow-counterclockwise', label: 'Restore', variant: 'primary', permission: 'a_courses.edit' },
        { key: 'purge', icon: 'bi-x-octagon-fill', label: 'Delete permanently', variant: 'danger', permission: 'a_courses.delete' },
      ] as QuickAction[],
    };
  }

  addCourse(): void { this.openDialog(CourseForm, {}, '860px'); }
  addCategory(): void { this.openDialog(CategoryForm, {}, '520px'); }

  open(row: TableRow): void {
    if (this.tab() === 'courses') this.openDialog(CourseView, { courseId: row['id'], mode: 'details' }, '820px');
    else if (this.tab() === 'categories') this.openDialog(CategoryView, { categoryId: row['id'] }, '560px');
  }

  /** Category list status switch: saves the new status; the table re-renders from the store either way. */
  async onToggle(event: { row: TableRow; key: string; checked: boolean }): Promise<void> {
    const k = this.store.categories.get(String(event.row['id']));
    if (!k) return;
    const st = event.checked ? 'Active' : 'Inactive';
    try {
      await this.store.saveCategory({ n: k.n, desc: k.desc, st }, k.id);
    } catch (e) {
      this.toast.error('Could not change the status', apiErrorMessage(e));
      return void this.refresh();
    }
    this.log.record('Course Management', `Set category ${k.n} ${st}`);
    this.toast.success(`${k.n} is now ${st.toLowerCase()}`);
    this.refresh();
  }

  onQuickAction(event: { row: TableRow; action: string }): void {
    const id = String(event.row['id']);
    switch (event.action) {
      case 'front': return void this.openDialog(CourseView, { courseId: id, mode: 'frontend' }, '760px');
      case 'view': return void this.openDialog(CourseView, { courseId: id, mode: 'details' }, '820px');
      case 'mods': return void this.openDialog(CourseModulesDialog, { courseId: id }, '860px');
      case 'students': return void this.openDialog(CourseStudents, { courseId: id }, '900px');
      case 'invite': return void this.openDialog(CourseInvite, { courseId: id }, '560px');
      case 'edit':
        return void (this.tab() === 'categories' ? this.openDialog(CategoryForm, { categoryId: id }, '520px') : this.openDialog(CourseForm, { courseId: id }, '860px'));
      case 'delete': return void (this.tab() === 'categories' ? this.deleteCategory(id) : this.deleteCourse(id));
      case 'restore': return void this.restoreCourse(id);
      case 'purge': return void this.purgeCourse(id);
    }
  }

  private async deleteCourse(id: string): Promise<void> {
    const c = this.store.get(id);
    if (!c) return;
    if (!(await this.toast.confirm('Delete course?', `${c.title} will be moved to the Deleted tab (soft delete). Enrollments and progress are kept, and you can restore it later.`, 'Yes, move to Deleted'))) return;
    try {
      await this.store.trashCourse(id);
    } catch (e) {
      return this.toast.error('Could not delete the course', apiErrorMessage(e));
    }
    this.log.record('Course Management', `Moved course ${c.code ?? c.id} to trash`);
    this.toast.success('Course moved to Deleted');
  }

  private async restoreCourse(id: string): Promise<void> {
    const c = this.store.get(id);
    if (!c) return;
    if (this.store.live().some(x => x.title.toLowerCase() === c.title.toLowerCase())) {
      return this.toast.error('A live course with this title exists', 'Rename it first.');
    }
    try {
      await this.store.restoreCourse(id);
    } catch (e) {
      return this.toast.error('Could not restore the course', apiErrorMessage(e));
    }
    this.log.record('Course Management', `Restored course ${c.code ?? c.id}`);
    this.toast.success('Course restored');
  }

  private async purgeCourse(id: string): Promise<void> {
    const c = this.store.get(id);
    if (!c) return;
    if (!(await this.toast.confirm('Delete permanently?', `${c.title} and its modules will be removed for good. This cannot be undone.`))) return;
    try {
      await this.store.purgeCourse(id);
    } catch (e) {
      return this.toast.error('Could not delete the course', apiErrorMessage(e));
    }
    this.log.record('Course Management', `Permanently deleted course ${c.code ?? c.id} — ${c.title}`);
    this.toast.success('Course deleted permanently');
  }

  private async deleteCategory(id: string): Promise<void> {
    const k = this.store.categories.get(id);
    if (!k) return;
    const used = this.store.categoryUse(k.n);
    if (used) return this.toast.error('Category in use', `${used} course(s) use “${k.n}” — change their category first.`);
    if (!(await this.toast.confirm('Delete category?', `Remove ${k.n}?`))) return;
    try {
      await this.store.deleteCategory(id);
    } catch (e) {
      return this.toast.error('Could not delete the category', apiErrorMessage(e));
    }
    this.log.record('Course Management', `Deleted category ${k.n}`);
    this.toast.success('Category deleted');
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, 'sharp-courses', 'Courses');
  }
}
