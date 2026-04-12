"use client";

import { track } from "@vercel/analytics";
import { useTripCart } from "./trip-cart-provider";

export default function TripCartButton({ courseId }: { courseId: string }) {
  const { isInTripCart, toggleTripCourse } = useTripCart();
  const inTripCart = isInTripCart(courseId);

  return (
    <button
      type="button"
      className={inTripCart ? "trip-cart-button trip-cart-button--active" : "trip-cart-button"}
      onClick={() => {
        track(inTripCart ? "trip_cart_remove" : "trip_cart_add", { course_id: courseId });
        toggleTripCourse(courseId);
      }}
      aria-pressed={inTripCart}
      aria-label={inTripCart ? "Remove from cart" : "Add to cart"}
      title={inTripCart ? "Remove from trip cart" : "Add to trip cart"}
    >
      <span className="trip-cart-button__icon-wrap">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="trip-cart-button__icon">
          <path
            d="M3.5 5.5h2.1l1.6 8.1a1 1 0 0 0 .98.8h8.95a1 1 0 0 0 .97-.76l1.58-6.14H7.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.25" cy="18.3" r="1.3" fill="currentColor" />
          <circle cx="16.75" cy="18.3" r="1.3" fill="currentColor" />
        </svg>
        {inTripCart ? (
          <span className="trip-cart-button__check" aria-hidden="true">
            <svg viewBox="0 0 12 12">
              <path d="M2 6.3 4.6 8.9 10 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
      </span>
    </button>
  );
}
