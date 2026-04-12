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
      title={inTripCart ? "Remove from trip cart" : "Add to trip cart"}
    >
      {inTripCart ? "In Trip Cart" : "Add Trip"}
    </button>
  );
}
