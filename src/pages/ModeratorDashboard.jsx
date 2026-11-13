/**
 * Basic Moderator Dashboard (staff only).
 * Users, idea moderation, content reports / pending queue.
 * Access: staff (founder | moderator | admin | project_lead).
 * Role Management tab is Founder-only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Shield,
  Loader2,
  RefreshCw,
  ExternalLink,
  Film,
  BookOpen,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';
import useStaffRole from '../hooks/useStaffRole';
import moderationService from '../services/moderationService';
import { tasksService } from '../services/tasksService';
import { listShowcaseForModeration, moderateShowcasePost } from '../services/showcaseService';
import IdeaTagsAdminPanel from '../components/ideas/IdeaTagsAdminPanel';
import DecisionLogsManager from '../components/transparency/DecisionLogsManager';
import StudioExpensesManager from '../components/transparency/StudioExpensesManager';
import TrafficPanel from '../components/moderation/TrafficPanel';
import GrantCreditPanel from '../components/staff/GrantCreditPanel';
import ConductPanel from '../components/conduct/ConductPanel';
import PollsPanel from '../components/moderation/PollsPanel';
import platformSuggestionsService from '../services/platformSuggestionsService';
import { OPEN_SUGGESTION_STATUSES } from '../constants/platformSuggestions';
import { pingUserNotices } from '../utils/userNotices';
import bugReportsService, { OPEN_BUG_STATUSES } from '../services/bugReportsService';
import taskSuggestionsService from '../services/taskSuggestionsService';
import {
  listVolunteerApplications,
  updateVolunteerApplicationStatus,
  listVolunteerApplyBlocks,
  blockVolunteerApplicant,
  unblockVolunteerApplicant,
  applicationMatchesBlock,
  normalizeVolunteerEmail,
  normalizeVolunteerDiscord,
  OPEN_VOLUNTEER_STATUSES,
  VOLUNTEER_STATUS_LABELS,
} from '../services/volunteerService';
import { listConductCases } from '../services/conductService';
import {
  listConcernReports,
  updateConcernReportStatus,
  OPEN_CONCERN_STATUSES,
  CONCERN_STATUS_LABELS,
} from '../services/reportConcernService';
import ScopeRequestsTab from './moderator/ScopeRequestsTab';
import UsersTab from './moderator/UsersTab';
import PlatformSuggestionsTab from './moderator/PlatformSuggestionsTab';
import IdeasTab from './moderator/IdeasTab';
import RestrictionsTab from './moderator/RestrictionsTab';
import ReportsTab from './moderator/ReportsTab';
import BugsTab from './moderator/BugsTab';
import QueueMark from './moderator/QueueMark';
import ShowcaseTab from './moderator/ShowcaseTab';
import SuggestedTasksTab from './moderator/SuggestedTasksTab';
import VolunteersTab from './moderator/VolunteersTab';
import ConcernsTab from './moderator/ConcernsTab';
import RolesTab from './moderator/RolesTab';
import {
  TABS,
  ALL_TABS,
  volunteerTypeLabel,
  volunteerRoleLabel,
  volunteerNeedLabel,
  volunteerSkillLabel,
  joinTime,
  ideaTime,
} from './moderator/shared';

const ModeratorDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isModerator,
    isFounder,
    userId,
    loading: roleLoading,
  } = useStaffRole();

  const visibleTabs = useMemo(
    () => (isFounder ? ALL_TABS : TABS),
    [isFounder]
  );

  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState(
    ALL_TABS.some((t) => t.id === initialTab) ? initialTab : 'users'
  );

  // Deep-link: /moderator?tab=scope. Only follow the URL, never
  // overwrite a click while searchParams is still stale.
  useEffect(() => {
    if (roleLoading) return;
    const t = searchParams.get('tab');
    const next = visibleTabs.some((x) => x.id === t) ? t : 'users';
    setTab((cur) => (cur === next ? cur : next));
  }, [searchParams, visibleTabs, roleLoading]);
  const [users, setUsers] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportsMissing, setReportsMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [showcasePending, setShowcasePending] = useState([]);
  const [showcaseMissing, setShowcaseMissing] = useState(false);
  const [scopeRequests, setScopeRequests] = useState([]);
  const [scopeMissing, setScopeMissing] = useState(false);
  const [scopeLoadError, setScopeLoadError] = useState('');
  const [scopePendingCount, setScopePendingCount] = useState(0);
  const [scopeStatusFilter, setScopeStatusFilter] = useState('pending');
  /** Optional resolve notes keyed by request id */
  const [scopeStaffNotes, setScopeStaffNotes] = useState({});
  const [restrictionEvents, setRestrictionEvents] = useState([]);
  const [restrictionsMissing, setRestrictionsMissing] = useState(false);
  const [restrictionsLoadError, setRestrictionsLoadError] = useState('');
  /**
   * In-app confirm dialog (replaces window.confirm).
   * @type {null | { title: string, message: string, confirmLabel?: string, onConfirm: () => void }}
   */
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Users filters / sort
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userSort, setUserSort] = useState('newest');
  const [roleSearch, setRoleSearch] = useState('');
  const [roleLog, setRoleLog] = useState([]);
  const [roleLogMissing, setRoleLogMissing] = useState(false);

  // Ideas filters / sort
  const [ideaSearch, setIdeaSearch] = useState('');
  const [ideaStatusFilter, setIdeaStatusFilter] = useState('all');
  const [ideaCategoryFilter, setIdeaCategoryFilter] = useState('all');
  const [ideaSort, setIdeaSort] = useState('newest');

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsMissing, setSuggestionsMissing] = useState(false);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState('all');
  const [bugs, setBugs] = useState([]);
  const [bugsMissing, setBugsMissing] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [volunteersMissing, setVolunteersMissing] = useState(false);
  const [volunteerBlocks, setVolunteerBlocks] = useState([]);
  const [volunteerStatusFilter, setVolunteerStatusFilter] = useState('open');
  const [volunteerTypeFilter, setVolunteerTypeFilter] = useState('all');
  const [volunteerSearch, setVolunteerSearch] = useState('');
  const [volunteerSort, setVolunteerSort] = useState('newest');
  const [conductOpenCount, setConductOpenCount] = useState(0);
  const [concerns, setConcerns] = useState([]);
  const [concernsMissing, setConcernsMissing] = useState(false);
  const [concernStatusFilter, setConcernStatusFilter] = useState('open');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 8000);
  };

  const load = useCallback(async () => {
    if (!isModerator) return;
    setLoading(true);
    setError('');
    // Load independently so a missing reports table does not break users/ideas
    const results = await Promise.allSettled([
      moderationService.listUsers({ limit: 200 }),
      moderationService.listIdeas({ limit: 200 }),
      moderationService.listReports({ status: 'all', limit: 50 }),
      listShowcaseForModeration({ status: 'pending', limit: 100 }),
      tasksService.listScopeRequests({
        status: scopeStatusFilter === 'all' ? 'all' : scopeStatusFilter,
        limit: 150,
      }),
      tasksService.countPendingScopeRequests(),
      tasksService.listRestrictionEvents(80),
      platformSuggestionsService.list({ includeHidden: true, limit: 100 }),
      bugReportsService.listBugs({ status: 'open', limit: 80 }),
      taskSuggestionsService.listPendingAll({ limit: 80 }),
      listVolunteerApplications({ status: 'all', limit: 200 }),
      listVolunteerApplyBlocks(),
      listConductCases({ status: 'queue', limit: 80 }),
    ]);

    const errs = [];

    if (results[0].status === 'fulfilled') {
      setUsers(results[0].value || []);
    } else {
      setUsers([]);
      console.error('[ModeratorDashboard] users', results[0].reason);
      errs.push(results[0].reason?.message || 'Could not load users');
    }

    if (results[1].status === 'fulfilled') {
      setIdeas(results[1].value || []);
    } else {
      setIdeas([]);
      console.error('[ModeratorDashboard] ideas', results[1].reason);
      errs.push(results[1].reason?.message || 'Could not load ideas');
    }

    if (results[2].status === 'fulfilled') {
      const r = results[2].value || {};
      setReports(r.reports || []);
      setReportsMissing(!!r.tableMissing);
    } else {
      setReports([]);
      const reason = results[2].reason;
      console.warn('[ModeratorDashboard] reports', reason);
      const missing =
        reason?.code === 'PGRST205' ||
        reason?.code === '42P01' ||
        (/does not exist|schema cache|Could not find the table/i.test(
          reason?.message || ''
        ) &&
          !/permission denied/i.test(reason?.message || ''));
      setReportsMissing(missing);
      if (!missing && reason?.message) {
        errs.push(reason.message);
      }
    }

    if (results[3].status === 'fulfilled') {
      setShowcasePending(results[3].value || []);
      setShowcaseMissing(false);
    } else {
      setShowcasePending([]);
      const reason = results[3].reason;
      const missing =
        reason?.code === 'TABLE_MISSING' ||
        /showcase table missing|community_showcase|does not exist|schema cache/i.test(
          reason?.message || ''
        );
      setShowcaseMissing(missing);
    }

    if (results[4].status === 'fulfilled') {
      setScopeRequests(results[4].value || []);
      setScopeMissing(false);
      setScopeLoadError('');
    } else {
      setScopeRequests([]);
      const reason = results[4].reason;
      console.warn('[ModeratorDashboard] scope', reason);
      const missing =
        reason?.code === 'SCOPE_TABLE_MISSING' ||
        (/Scope requests are not set up|does not exist|schema cache/i.test(
          reason?.message || ''
        ) &&
          !/permission denied/i.test(reason?.message || ''));
      setScopeMissing(missing);
      setScopeLoadError(
        missing
          ? ''
          : reason?.message ||
              'Could not load scope requests. Check the browser console and RLS policies.'
      );
    }

    if (results[5].status === 'fulfilled') {
      setScopePendingCount(results[5].value || 0);
    } else {
      setScopePendingCount(0);
    }

    if (results[6].status === 'fulfilled') {
      setRestrictionEvents(results[6].value || []);
      setRestrictionsMissing(false);
      setRestrictionsLoadError('');
    } else {
      setRestrictionEvents([]);
      const reason = results[6].reason;
      const missing =
        reason?.code === 'RESTRICTION_TABLE_MISSING' ||
        /task_restriction|list_recent_restriction|does not exist|schema cache/i.test(
          reason?.message || ''
        );
      setRestrictionsMissing(missing);
      setRestrictionsLoadError(
        missing
          ? ''
          : reason?.message || 'Could not load restriction audit events.'
      );
    }

    if (results[7].status === 'fulfilled') {
      setSuggestions(results[7].value || []);
      setSuggestionsMissing(false);
    } else {
      setSuggestions([]);
      const reason = results[7].reason;
      const missing =
        /platform_suggestions|not set up yet|does not exist|schema cache/i.test(
          reason?.message || ''
        );
      setSuggestionsMissing(missing);
      if (!missing && reason?.message) {
        errs.push(reason.message);
      }
    }

    if (results[8].status === 'fulfilled') {
      setBugs(results[8].value || []);
      setBugsMissing(false);
    } else {
      setBugs([]);
      const reason = results[8].reason;
      const missing =
        reason?.code === 'MISSING_TABLE' ||
        /bug tracker is not set up|bug_reports|does not exist|schema cache/i.test(
          reason?.message || ''
        );
      setBugsMissing(missing);
      if (!missing && reason?.message) {
        errs.push(reason.message);
      }
    }

    if (results[9].status === 'fulfilled') {
      setSuggestedTasks(results[9].value || []);
    } else {
      setSuggestedTasks([]);
    }

    if (results[10].status === 'fulfilled') {
      setVolunteers(results[10].value || []);
      setVolunteersMissing(false);
    } else {
      setVolunteers([]);
      const reason = results[10].reason;
      const missing =
        reason?.code === 'MISSING_TABLE' ||
        /volunteer applications are not set up|volunteer_applications|does not exist|schema cache/i.test(
          reason?.message || ''
        );
      setVolunteersMissing(missing);
      if (!missing && reason?.message) {
        errs.push(reason.message);
      }
    }

    if (results[11].status === 'fulfilled') {
      setVolunteerBlocks(results[11].value || []);
    } else {
      setVolunteerBlocks([]);
    }

    if (results[12].status === 'fulfilled') {
      setConductOpenCount((results[12].value || []).length);
    } else {
      setConductOpenCount(0);
    }

    if (isFounder) {
      try {
        const log = await moderationService.listRoleChanges({ limit: 50 });
        setRoleLog(log.entries || []);
        setRoleLogMissing(!!log.tableMissing);
      } catch (e) {
        setRoleLog([]);
        setRoleLogMissing(false);
        console.error('[ModeratorDashboard] role log', e);
        errs.push(e?.message || 'Could not load role change log');
      }
      try {
        const rows = await listConcernReports({ status: 'all', limit: 200 });
        setConcerns(rows);
        setConcernsMissing(false);
      } catch (e) {
        setConcerns([]);
        const missing =
          e?.code === 'MISSING_TABLE' ||
          /concern reports are not set up|concern_reports|does not exist|schema cache/i.test(
            e?.message || ''
          );
        setConcernsMissing(missing);
        if (!missing && e?.message) {
          errs.push(e.message);
        }
      }
    } else {
      setRoleLog([]);
      setRoleLogMissing(false);
      setConcerns([]);
      setConcernsMissing(false);
    }

    if (errs.length) setError(errs.join(' · '));
    setLoading(false);
    pingUserNotices();
  }, [isModerator, isFounder, scopeStatusFilter]);

  useEffect(() => {
    if (!roleLoading && isModerator) load();
  }, [roleLoading, isModerator, load]);

  const userRoles = useMemo(() => {
    const set = new Set();
    for (const u of users) {
      const r = String(u.role || 'user').trim();
      if (r) set.add(r);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [users]);

  const ideaCategories = useMemo(() => {
    const set = new Set();
    for (const idea of ideas) {
      const c = String(idea.category || '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const openSuggestionCount = useMemo(
    () =>
      suggestions.filter((s) =>
        OPEN_SUGGESTION_STATUSES.includes(s.status)
      ).length,
    [suggestions]
  );

  const filteredSuggestions = useMemo(() => {
    if (suggestionStatusFilter === 'all') return suggestions;
    if (suggestionStatusFilter === 'hidden') {
      return suggestions.filter((s) => s.isHidden);
    }
    return suggestions.filter((s) => s.status === suggestionStatusFilter);
  }, [suggestions, suggestionStatusFilter]);

  const filteredVolunteers = useMemo(() => {
    const q = volunteerSearch.trim().toLowerCase();
    let list = volunteers.filter((app) => {
      if (volunteerStatusFilter === 'open') {
        if (!OPEN_VOLUNTEER_STATUSES.includes(app.status)) return false;
      } else if (volunteerStatusFilter === 'blocked') {
        if (!volunteerBlocks.some((b) => applicationMatchesBlock(app, b))) {
          return false;
        }
      } else if (
        volunteerStatusFilter !== 'all' &&
        app.status !== volunteerStatusFilter
      ) {
        return false;
      }
      if (
        volunteerTypeFilter !== 'all' &&
        app.applicationType !== volunteerTypeFilter
      ) {
        return false;
      }
      if (q) {
        const hay = [
          app.handle,
          app.email,
          app.discordUsername,
          app.description,
          volunteerTypeLabel(app.applicationType),
          volunteerRoleLabel(app.roleId),
          volunteerNeedLabel(app.openNeedId),
          ...(app.skillAreas || []).map(volunteerSkillLabel),
          app.skillOther,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list];
    list.sort((a, b) => {
      if (volunteerSort === 'oldest') {
        return Date.parse(a.createdAt || '') - Date.parse(b.createdAt || '');
      }
      if (volunteerSort === 'handle') {
        return String(a.handle || '').localeCompare(String(b.handle || ''), undefined, {
          sensitivity: 'base',
        });
      }
      return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '');
    });
    return list;
  }, [
    volunteers,
    volunteerBlocks,
    volunteerStatusFilter,
    volunteerTypeFilter,
    volunteerSearch,
    volunteerSort,
  ]);

  const filteredConcerns = useMemo(() => {
    let list = concerns.filter((row) => {
      if (concernStatusFilter === 'open') {
        return OPEN_CONCERN_STATUSES.includes(row.status);
      }
      if (concernStatusFilter === 'all') return true;
      return row.status === concernStatusFilter;
    });
    return [...list].sort(
      (a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
    );
  }, [concerns, concernStatusFilter]);

  const handleSuggestionStatus = async (id, status) => {
    setBusyKey(`sug-${id}`);
    setError('');
    try {
      const updated = await platformSuggestionsService.updateStatus(id, status);
      setSuggestions((prev) => prev.map((x) => (x.id === id ? updated : x)));
      showToast(`Status → ${status}`);
      pingUserNotices();
    } catch (e) {
      setError(e?.message || 'Could not update suggestion.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSuggestionHidden = async (id, hidden) => {
    setBusyKey(`sug-${id}`);
    setError('');
    try {
      const updated = await platformSuggestionsService.setHidden(id, hidden);
      setSuggestions((prev) => prev.map((x) => (x.id === id ? updated : x)));
      showToast(hidden ? 'Hidden from the public list' : 'Visible on the public list');
      pingUserNotices();
    } catch (e) {
      setError(e?.message || 'Could not update visibility.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSuggestionDelete = (item) => {
    if (!item?.id) return;
    setConfirmDialog({
      title: 'Delete suggestion',
      message: `Delete “${item.title || 'this suggestion'}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        void (async () => {
          setBusyKey(`sug-${item.id}`);
          setError('');
          try {
            await platformSuggestionsService.remove(item.id);
            setSuggestions((prev) => prev.filter((x) => x.id !== item.id));
            showToast('Suggestion deleted');
            pingUserNotices();
          } catch (e) {
            setError(e?.message || 'Could not delete suggestion.');
          } finally {
            setBusyKey(null);
          }
        })();
      },
    });
  };

  const handleShowcaseAction = async (id, action, successMsg) => {
    setBusyKey(`showcase-${id}`);
    setError('');
    try {
      await moderateShowcasePost(id, action);
      setShowcasePending((prev) => prev.filter((p) => p.id !== id));
      showToast(successMsg);
      pingUserNotices();
    } catch (e) {
      setError(e?.message || 'Could not update showcase submission.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSuggestedAccept = async (id) => {
    setBusyKey(`suggested-${id}`);
    setError('');
    try {
      await taskSuggestionsService.review(id, 'accept');
      setSuggestedTasks((prev) => prev.filter((x) => x.id !== id));
      showToast('Accepted — card is on Staging');
      pingUserNotices();
    } catch (e) {
      setError(e?.message || 'Could not accept suggested task.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleConcernStatus = async (id, status) => {
    setBusyKey(`concern-${id}`);
    setError('');
    try {
      const updated = await updateConcernReportStatus(id, status);
      setConcerns((prev) => prev.map((c) => (c.id === id ? updated : c)));
      showToast(`Concern → ${CONCERN_STATUS_LABELS[status] || status}`);
      pingUserNotices();
    } catch (e) {
      setError(e?.message || 'Could not update concern.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleVolunteerStatus = async (id, status) => {
    setBusyKey(`vol-${id}`);
    setError('');
    try {
      const updated = await updateVolunteerApplicationStatus(id, status);
      setVolunteers((prev) => prev.map((v) => (v.id === id ? updated : v)));
      showToast(`Application → ${VOLUNTEER_STATUS_LABELS[status] || status}`);
      pingUserNotices();
    } catch (e) {
      setError(e?.message || 'Could not update application.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleVolunteerBlock = (app) => {
    if (!app?.id) return;
    setConfirmDialog({
      title: 'Block applicant',
      message: `Block ${app.handle || 'this applicant'} from submitting more Get Involved applications? We match their account, email, and Discord username. Open applications from them will be declined.`,
      confirmLabel: 'Block applicant',
      onConfirm: () => {
        void (async () => {
          setBusyKey(`vol-${app.id}`);
          setError('');
          try {
            await blockVolunteerApplicant(app);
            setVolunteers((prev) =>
              prev.map((v) =>
                applicationMatchesBlock(v, {
                  active: true,
                  userId: app.userId,
                  email: normalizeVolunteerEmail(app.email) || null,
                  discordUsername:
                    normalizeVolunteerDiscord(app.discordUsername) || null,
                }) && OPEN_VOLUNTEER_STATUSES.includes(v.status)
                  ? { ...v, status: 'declined' }
                  : v
              )
            );
            const blocks = await listVolunteerApplyBlocks();
            setVolunteerBlocks(blocks);
            showToast('Applicant blocked from further applications');
            pingUserNotices();
          } catch (e) {
            setError(e?.message || 'Could not block this applicant.');
          } finally {
            setBusyKey(null);
          }
        })();
      },
    });
  };

  const handleVolunteerUnblock = (block) => {
    if (!block?.id) return;
    setConfirmDialog({
      title: 'Lift application block',
      message: `Allow ${
        block.email || block.discordUsername || 'this contact'
      } to submit Get Involved applications again?`,
      confirmLabel: 'Lift block',
      onConfirm: () => {
        void (async () => {
          setBusyKey(`volblock-${block.id}`);
          setError('');
          try {
            await unblockVolunteerApplicant(block.id);
            setVolunteerBlocks((prev) =>
              prev.filter((b) => b.id !== block.id)
            );
            showToast('Block lifted');
          } catch (e) {
            setError(e?.message || 'Could not lift this block.');
          } finally {
            setBusyKey(null);
          }
        })();
      },
    });
  };

  const handleBugStatus = async (id, status) => {
    setBusyKey(`bug-${id}`);
    setError('');
    try {
      const updated = await bugReportsService.updateStatus(id, status);
      setBugs((prev) => {
        const next = prev.map((b) => (b.id === id ? updated : b));
        if (!OPEN_BUG_STATUSES.includes(updated.status)) {
          return next.filter((b) => b.id !== id);
        }
        return next;
      });
      showToast(`Bug status → ${status}`);
      pingUserNotices();
    } catch (e) {
      setError(e?.message || 'Could not update bug.');
    } finally {
      setBusyKey(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    let list = users.filter((u) => {
      const status = u.moderation_status || 'active';
      const role = String(u.role || 'user');
      if (userRoleFilter !== 'all' && role !== userRoleFilter) return false;
      if (userStatusFilter !== 'all' && status !== userStatusFilter) return false;
      if (q) {
        const hay = `${u.username || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list];
    list.sort((a, b) => {
      switch (userSort) {
        case 'oldest':
          return joinTime(a) - joinTime(b);
        case 'name_az':
          return String(a.username || '').localeCompare(
            String(b.username || ''),
            undefined,
            { sensitivity: 'base' }
          );
        case 'name_za':
          return String(b.username || '').localeCompare(
            String(a.username || ''),
            undefined,
            { sensitivity: 'base' }
          );
        case 'role':
          return String(a.role || '').localeCompare(String(b.role || ''));
        case 'newest':
        default:
          return joinTime(b) - joinTime(a);
      }
    });
    return list;
  }, [users, userSearch, userRoleFilter, userStatusFilter, userSort]);

  const filteredRoleUsers = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    const list = q
      ? users.filter((u) => {
          const hay = `${u.username || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase();
          return hay.includes(q);
        })
      : users;
    return [...list].sort((a, b) =>
      String(a.username || '').localeCompare(String(b.username || ''), undefined, {
        sensitivity: 'base',
      })
    );
  }, [users, roleSearch]);



  const filteredIdeas = useMemo(() => {
    const q = ideaSearch.trim().toLowerCase();
    let list = ideas.filter((idea) => {
      const status = idea.status || 'Proposed';
      const category = String(idea.category || '').trim();
      if (ideaStatusFilter !== 'all' && status !== ideaStatusFilter) return false;
      if (ideaCategoryFilter !== 'all' && category !== ideaCategoryFilter) {
        return false;
      }
      if (q) {
        const hay =
          `${idea.title || ''} ${idea.summary || ''} ${idea.category || ''} ${idea.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list];
    list.sort((a, b) => {
      switch (ideaSort) {
        case 'oldest':
          return ideaTime(a) - ideaTime(b);
        case 'votes_high':
          return (Number(b.votes) || 0) - (Number(a.votes) || 0);
        case 'votes_low':
          return (Number(a.votes) || 0) - (Number(b.votes) || 0);
        case 'title_az':
          return String(a.title || '').localeCompare(
            String(b.title || ''),
            undefined,
            { sensitivity: 'base' }
          );
        case 'newest':
        default:
          return ideaTime(b) - ideaTime(a);
      }
    });
    return list;
  }, [ideas, ideaSearch, ideaStatusFilter, ideaCategoryFilter, ideaSort]);

  const runAction = async (key, fn, successMsg) => {
    setBusyKey(key);
    setError('');
    try {
      await fn();
      if (successMsg) showToast(successMsg);
      await load();
    } catch (e) {
      console.error('[ModeratorDashboard] action', e);
      setError(e?.message || 'Action failed. You may need staff RLS policies.');
    } finally {
      setBusyKey(null);
    }
  };

  if (roleLoading) {
    return (
      <div className="pt-28 min-h-screen flex items-center justify-center text-text-muted gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
        <span className="font-mono text-sm tracking-widest uppercase">
          Checking access
        </span>
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
        <div className="container-custom py-16 max-w-lg">
          <Card className="bg-cyber-card/80 text-center py-10 px-6">
            <Shield className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Staff only</h1>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              This dashboard is for moderators.
              If you need access, contact the site owner.
            </p>
            <Button variant="secondary" to="/">
              Back home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const openBugCount = bugs.filter((b) =>
    OPEN_BUG_STATUSES.includes(b.status)
  ).length;
  const showcasePendingCount = showcasePending.length;
  const volunteerOpenCount = volunteers.filter((v) =>
    OPEN_VOLUNTEER_STATUSES.includes(v.status)
  ).length;
  const concernOpenCount = concerns.filter((c) =>
    OPEN_CONCERN_STATUSES.includes(c.status)
  ).length;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.04)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg border border-cyber-border bg-cyber-surface text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      <div className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 md:py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="section-header mb-0">Staff tools</div>
                <Badge variant="neon">Moderator</Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Moderator Dashboard
              </h1>
              <p className="text-text-secondary mt-2 text-sm sm:text-base max-w-xl">
                Basic user, idea, and report tools. Keep it light. Prefer archive
                over hard delete when possible. Base enforcement on the published{' '}
                <Link
                  to="/guidelines"
                  className="text-neon-cyan hover:underline"
                >
                  Community Guidelines
                </Link>
                .
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto"
              onClick={load}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link
              to="/guidelines"
              className="inline-flex items-center gap-1.5 text-text-secondary hover:text-white"
            >
              <BookOpen className="w-4 h-4 text-neon-green" aria-hidden />
              Community Guidelines
            </Link>
            <Link
              to="/media/edit"
              className="inline-flex items-center gap-1.5 text-text-secondary hover:text-white"
            >
              <Film className="w-4 h-4 text-neon-cyan" aria-hidden />
              Official Media
              <ExternalLink className="w-3.5 h-3.5 opacity-50" aria-hidden />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2" role="tablist">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.id);
                    setSearchParams({ tab: t.id }, { replace: true });
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono tracking-widest uppercase border transition-colors ${
                    active
                      ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                      : 'border-cyber-border text-text-muted hover:border-neon-cyan/40 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {t.id === 'reports' && (
                    <QueueMark
                      count={pendingCount}
                      className="bg-neon-magenta/20 text-neon-magenta"
                      label={`${pendingCount} pending reports`}
                    />
                  )}
                  {t.id === 'scope' && (
                    <QueueMark
                      count={scopePendingCount}
                      className="bg-semantic-warning/20 text-semantic-warning"
                      label={`${scopePendingCount} pending scope requests`}
                    />
                  )}
                  {t.id === 'suggestions' && (
                    <QueueMark
                      count={openSuggestionCount}
                      className="bg-neon-cyan/20 text-neon-cyan"
                      label={`${openSuggestionCount} open suggestions`}
                    />
                  )}
                  {t.id === 'bugs' && (
                    <QueueMark
                      count={openBugCount}
                      className="bg-red-500/20 text-red-300"
                      label={`${openBugCount} open bugs`}
                    />
                  )}
                  {t.id === 'showcase' && (
                    <QueueMark
                      count={showcasePendingCount}
                      className="bg-neon-purple/20 text-neon-purple"
                      label={`${showcasePendingCount} pending showcase submissions`}
                    />
                  )}
                  {t.id === 'suggested' && (
                    <QueueMark
                      count={suggestedTasks.length}
                      className="bg-forge-gold/20 text-forge-gold"
                      label={`${suggestedTasks.length} pending suggested tasks`}
                    />
                  )}
                  {t.id === 'conduct' && (
                    <QueueMark
                      count={conductOpenCount}
                      className="bg-semantic-warning/20 text-semantic-warning"
                      label={`${conductOpenCount} open conduct cases`}
                    />
                  )}
                  {t.id === 'volunteers' && (
                    <QueueMark
                      count={volunteerOpenCount}
                      className="bg-neon-green/20 text-neon-green"
                      label={`${volunteerOpenCount} volunteer applications`}
                    />
                  )}
                  {t.id === 'concerns' && (
                    <QueueMark
                      count={concernOpenCount}
                      className="bg-semantic-warning/20 text-semantic-warning"
                      label={`${concernOpenCount} private concern reports`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-10 md:py-12 max-w-5xl space-y-6">
        {error && (
          <Card className="bg-red-400/10 border-red-400/40">
            <p className="text-sm text-red-100" role="alert">
              {error}
            </p>
          </Card>
        )}

        {loading &&
          !users.length &&
          !ideas.length &&
          tab !== 'traffic' &&
          tab !== 'credit' &&
          tab !== 'conduct' &&
          tab !== 'polls' &&
          tab !== 'volunteers' &&
          tab !== 'suggested' &&
          tab !== 'concerns' && (
          <LoadingScreen variant="section" message="Loading…" />
        )}

        {/* ---------- Scope help (task breakdown requests) ---------- */}
        {tab === 'traffic' && <TrafficPanel />}

        {tab === 'conduct' && <ConductPanel />}

        {tab === 'polls' && <PollsPanel />}

        {tab === 'credit' && (
          <section aria-labelledby="credit-heading">
            <div className="mb-4">
              <h2
                id="credit-heading"
                className="text-xl sm:text-2xl font-bold text-white tracking-tight"
              >
                Grant Credit
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
                Credit people who helped the studio or a project off the task
                board — Discord moderation, playtests, videos, writing,
                organizing. They appear on Contributors and their profile as
                Staff credited. This does not complete a task or change board
                counts.
              </p>
            </div>
            <GrantCreditPanel />
          </section>
        )}

        {tab === 'scope' && (
          <ScopeRequestsTab
            busyKey={busyKey}
            loading={loading}
            runAction={runAction}
            scopeLoadError={scopeLoadError}
            scopeMissing={scopeMissing}
            scopeRequests={scopeRequests}
            scopeStaffNotes={scopeStaffNotes}
            scopeStatusFilter={scopeStatusFilter}
            setScopeStaffNotes={setScopeStaffNotes}
            setScopeStatusFilter={setScopeStatusFilter}
          />
        )}

        {/* ---------- Users ---------- */}
        {tab === 'users' && (
          <UsersTab
            busyKey={busyKey}
            filteredUsers={filteredUsers}
            loading={loading}
            runAction={runAction}
            setConfirmDialog={setConfirmDialog}
            setUserRoleFilter={setUserRoleFilter}
            setUserSearch={setUserSearch}
            setUserSort={setUserSort}
            setUserStatusFilter={setUserStatusFilter}
            userRoleFilter={userRoleFilter}
            userRoles={userRoles}
            users={users}
            userSearch={userSearch}
            userSort={userSort}
            userStatusFilter={userStatusFilter}
          />
        )}

        {/* ---------- Platform suggestions ---------- */}
        {tab === 'suggestions' && (
          <PlatformSuggestionsTab
            busyKey={busyKey}
            filteredSuggestions={filteredSuggestions}
            handleSuggestionDelete={handleSuggestionDelete}
            handleSuggestionHidden={handleSuggestionHidden}
            handleSuggestionStatus={handleSuggestionStatus}
            loading={loading}
            setSuggestionStatusFilter={setSuggestionStatusFilter}
            suggestionsMissing={suggestionsMissing}
            suggestionStatusFilter={suggestionStatusFilter}
          />
        )}

        {/* ---------- Idea tags (hybrid catalog) ---------- */}
        {tab === 'tags' && (
          <section aria-labelledby="tags-heading">
            <IdeaTagsAdminPanel />
          </section>
        )}

        {tab === 'decisions' && (
          <section aria-labelledby="decisions-heading">
            <div className="mb-4">
              <h2
                id="decisions-heading"
                className="text-xl sm:text-2xl font-bold text-white tracking-tight"
              >
                Decision logs
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Public notes on the Transparency Hub. Archive to hide an entry
                without deleting it.
              </p>
              <Link
                to="/transparency#decisions"
                className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
              >
                View public list
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <DecisionLogsManager userId={userId} />
          </section>
        )}

        {tab === 'expenses' && (
          <section aria-labelledby="expenses-heading">
            <div className="mb-4">
              <h2
                id="expenses-heading"
                className="text-xl sm:text-2xl font-bold text-white tracking-tight"
              >
                Studio expenses
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Published Together Forge LLC spend from Relay Operating. This is
                the Transparency expense report, not a bank feed. Do not add
                Stripe payouts, tax withholding, refunds, or Runway/Ko-fi.
              </p>
              <Link
                to="/transparency#financials"
                className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline mt-2"
              >
                View public report
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <StudioExpensesManager userId={userId} />
          </section>
        )}

        {/* ---------- Ideas ---------- */}
        {tab === 'ideas' && (
          <IdeasTab
            busyKey={busyKey}
            filteredIdeas={filteredIdeas}
            ideaCategories={ideaCategories}
            ideaCategoryFilter={ideaCategoryFilter}
            ideas={ideas}
            ideaSearch={ideaSearch}
            ideaSort={ideaSort}
            ideaStatusFilter={ideaStatusFilter}
            loading={loading}
            runAction={runAction}
            setConfirmDialog={setConfirmDialog}
            setIdeaCategoryFilter={setIdeaCategoryFilter}
            setIdeaSearch={setIdeaSearch}
            setIdeaSort={setIdeaSort}
            setIdeaStatusFilter={setIdeaStatusFilter}
          />
        )}

        {/* ---------- Claim restrictions audit ---------- */}
        {tab === 'restrictions' && (
          <RestrictionsTab
            restrictionEvents={restrictionEvents}
            restrictionsLoadError={restrictionsLoadError}
            restrictionsMissing={restrictionsMissing}
            users={users}
          />
        )}

        {/* ---------- Reports ---------- */}
        {tab === 'reports' && (
          <ReportsTab
            busyKey={busyKey}
            loading={loading}
            reports={reports}
            reportsMissing={reportsMissing}
            runAction={runAction}
          />
        )}

        {/* ---------- Bug reports ---------- */}
        {tab === 'bugs' && (
          <BugsTab
            bugs={bugs}
            bugsMissing={bugsMissing}
            busyKey={busyKey}
            handleBugStatus={handleBugStatus}
            loading={loading}
          />
        )}

        {/* ---------- Showcase submissions ---------- */}
        {tab === 'showcase' && (
          <ShowcaseTab
            busyKey={busyKey}
            handleShowcaseAction={handleShowcaseAction}
            loading={loading}
            showcaseMissing={showcaseMissing}
            showcasePending={showcasePending}
          />
        )}

        {/* ---------- Suggested tasks ---------- */}
        {tab === 'suggested' && (
          <SuggestedTasksTab
            busyKey={busyKey}
            handleSuggestedAccept={handleSuggestedAccept}
            loading={loading}
            suggestedTasks={suggestedTasks}
          />
        )}

        {/* ---------- Volunteer applications ---------- */}
        {tab === 'volunteers' && (
          <VolunteersTab
            busyKey={busyKey}
            filteredVolunteers={filteredVolunteers}
            handleVolunteerBlock={handleVolunteerBlock}
            handleVolunteerStatus={handleVolunteerStatus}
            handleVolunteerUnblock={handleVolunteerUnblock}
            loading={loading}
            setVolunteerSearch={setVolunteerSearch}
            setVolunteerSort={setVolunteerSort}
            setVolunteerStatusFilter={setVolunteerStatusFilter}
            setVolunteerTypeFilter={setVolunteerTypeFilter}
            volunteerBlocks={volunteerBlocks}
            volunteers={volunteers}
            volunteerSearch={volunteerSearch}
            volunteersMissing={volunteersMissing}
            volunteerSort={volunteerSort}
            volunteerStatusFilter={volunteerStatusFilter}
            volunteerTypeFilter={volunteerTypeFilter}
          />
        )}

        {/* ---------- Private concerns (Founder only) ---------- */}
        {tab === 'concerns' && isFounder && (
          <ConcernsTab
            busyKey={busyKey}
            concerns={concerns}
            concernsMissing={concernsMissing}
            concernStatusFilter={concernStatusFilter}
            filteredConcerns={filteredConcerns}
            handleConcernStatus={handleConcernStatus}
            loading={loading}
            setConcernStatusFilter={setConcernStatusFilter}
          />
        )}

        {/* ---------- Role Management (Founder only) ---------- */}
        {tab === 'roles' && isFounder && (
          <RolesTab
            busyKey={busyKey}
            filteredRoleUsers={filteredRoleUsers}
            loading={loading}
            roleLog={roleLog}
            roleLogMissing={roleLogMissing}
            roleSearch={roleSearch}
            runAction={runAction}
            setConfirmDialog={setConfirmDialog}
            setRoleSearch={setRoleSearch}
            userId={userId}
            users={users}
          />
        )}
      </div>

      <Modal
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirm'}
        size="sm"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {confirmDialog?.message}
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmDialog(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const action = confirmDialog?.onConfirm;
              setConfirmDialog(null);
              action?.();
            }}
          >
            {confirmDialog?.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ModeratorDashboard;
