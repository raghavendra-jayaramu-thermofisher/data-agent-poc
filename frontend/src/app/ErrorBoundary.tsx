import { Component, type ReactNode } from 'react';
import { PageError } from '../components/PageState';
export class ErrorBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        if (this.state.failed) {
            return (<PageError message="The application hit an unexpected error. Reload the page to continue." retry={() => location.reload()}/>);
        }
        return this.props.children;
    }
}
