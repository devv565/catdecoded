document.addEventListener("DOMContentLoaded", function () {
  const carouselElement = document.querySelector("#catHeroCarousel");

  if (carouselElement) {
    new bootstrap.Carousel(carouselElement, {
      interval: 5000,
      ride: "carousel",
      pause: "hover",
      wrap: true
    });
  }
});
