import { Outlet } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth';

export default function DriverLayout() {
  const { user } = useAuth();
  return (
    <Layout role="driver" user={user} title="Dashboard Sopir">
      <Outlet />
    </Layout>
  );
}
