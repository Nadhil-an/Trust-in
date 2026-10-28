import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/shared'
import { AlertCircle, ArrowRight } from 'lucide-react'
import AnalyticsTab from './tabs/AnalyticsTab'
import PostManagementTab from './tabs/PostManagementTab'
import VerificationTab from './tabs/VerificationTab'
import OfficialPublishingTab from './tabs/OfficialPublishingTab'
import PomTab from './tabs/PomTab'
import VotingTab from './tabs/VotingTab'

// Member Management, Achievements & Recognition (MRM) Tabs
import MRMMembersTab from './tabs/MRMMembersTab'
import MRMTasksTab from './tabs/MRMTasksTab'
import MRMBadgesTab from './tabs/MRMBadgesTab'
import MRMVolunteersTab from './tabs/MRMVolunteersTab'
import MRMAppreciationTab from './tabs/MRMAppreciationTab'

const TAB_CONFIG = {
  analytics: {
    label: 'Platform Analytics',
    desc: 'Real-time telemetry, user growth trajectory, engagement trends and moderation metrics'
  },
  mrm_members: {
    label: 'Member Directory',
    desc: '360° member dossiers, administrative interaction logs and confidential governance notes'
  },
  mrm_tasks: {
    label: 'Tasks & Targets',
    desc: 'Assign actionable objectives, review submission evidence and audit performance metrics'
  },
  mrm_badges: {
    label: 'Badges & Recognition',
    desc: 'Automated 25% incremental progression badges, merit evaluations and awards registry'
  },
  mrm_volunteers: {
    label: 'Volunteers & Desk',
    desc: 'Field volunteer applications, Maroon badge authorizations and stipend disbursements'
  },
  mrm_appreciation: {
    label: 'Appreciation Studio',
    desc: 'Compose and publish public member commendations to community and mobile feeds'
  },
  posts: {
    label: 'Post Moderation',
    desc: 'Review public and self posts, enforce community standards and maintain moderation audit trail'
  },
  verifications: {
    label: 'Account Verification',
    desc: 'Audit government identity credentials, verify member accounts and grant verified status'
  },
  official: {
    label: 'Official Trust Publishing',
    desc: 'Draft, preview and broadcast verified Trust announcements to member mobile feeds'
  },
  pom: {
    label: 'Public Cooperation (POM)',
    desc: 'Manage Public Cooperation Messages for community relief, medical aid and emergency appeals'
  },
  voting: {
    label: 'Voting & Polls',
    desc: 'Configure verified ballots, manage voter eligibility and monitor live vote tallies'
  }
}

export default function SocialMediaDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'analytics'

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey })
  }

  const currentTab = TAB_CONFIG[activeTab] || TAB_CONFIG.analytics

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title={currentTab.label}
        subtitle={currentTab.desc}
      >
        <Link to="/slt/social/public-issues" className="btn btn-secondary btn-sm">
          <AlertCircle size={14} />
          Public Issues Queue
        </Link>
        <Link to="/slt/mgr/requests" className="btn btn-primary btn-sm">
          Manager Portal
          <ArrowRight size={14} />
        </Link>
      </PageHeader>

      <div style={{ width: '100%' }}>
        {activeTab === 'analytics' && <AnalyticsTab onNavigateTab={handleTabChange} />}
        {activeTab === 'mrm_members' && <MRMMembersTab />}
        {activeTab === 'mrm_tasks' && <MRMTasksTab />}
        {activeTab === 'mrm_badges' && <MRMBadgesTab />}
        {activeTab === 'mrm_volunteers' && <MRMVolunteersTab />}
        {activeTab === 'mrm_appreciation' && <MRMAppreciationTab />}
        {activeTab === 'posts' && <PostManagementTab />}
        {activeTab === 'verifications' && <VerificationTab />}
        {activeTab === 'official' && <OfficialPublishingTab />}
        {activeTab === 'pom' && <PomTab />}
        {activeTab === 'voting' && <VotingTab />}
      </div>
    </div>
  )
}
