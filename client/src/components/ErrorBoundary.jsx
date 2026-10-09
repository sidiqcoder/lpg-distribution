import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="card max-w-640" role="alert">
      <h2>Halaman belum dapat ditampilkan</h2>
      <p>Muat ulang untuk mencoba kembali.</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>Muat Ulang</button>
    </div>;
    return this.props.children;
  }
}
