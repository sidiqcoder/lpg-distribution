import { Outlet, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth';
import { todayWITA } from '../../utils';

export default function ManagerLayout() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayWITA();
  const setDate = (d) => { const p = new URLSearchParams(params); p.set('date', d); setParams(p); };

  return (
    <Layout role="manager" user={user} title="Dashboard Manager">
      <Outlet context={{ date, setDate }} />
    </Layout>
  );
}
