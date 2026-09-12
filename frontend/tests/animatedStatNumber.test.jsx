import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AnimatedStatNumber from '../src/components/common/AnimatedStatNumber';

describe('AnimatedStatNumber', () => {
  it('renders integer formatted with locale grouping by default', () => {
    render(<AnimatedStatNumber value={1452859} suffix=" token" />);
    expect(screen.getByText('1.452.859 token')).toBeInTheDocument();
  });

  it('renders decimals correctly with prefix and suffix', () => {
    render(
      <AnimatedStatNumber
        value={0.6138}
        decimals={4}
        prefix="$"
        suffix=" USD"
      />
    );
    expect(screen.getByText('$0.6138 USD')).toBeInTheDocument();
  });

  it('supports custom formatter callback', () => {
    const customFormatter = (val) => `CUSTOM-${Math.round(val)}`;
    render(<AnimatedStatNumber value={42} formatter={customFormatter} />);
    expect(screen.getByText('CUSTOM-42')).toBeInTheDocument();
  });

  it('updates display when value prop changes', () => {
    const { rerender } = render(
      <AnimatedStatNumber value={100} suffix=" users" />
    );
    expect(screen.getByText('100 users')).toBeInTheDocument();

    rerender(<AnimatedStatNumber value={250} suffix=" users" />);
    expect(screen.getByText('250 users')).toBeInTheDocument();
  });
});
