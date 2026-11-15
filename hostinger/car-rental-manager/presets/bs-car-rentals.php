<?php
/* BS Car Rentals: business details, rules and fleet, taken from the live website bscarrental.co.in.
   Not known from the website (the owner enters them later): registration numbers, kilometre readings,
   monthly prices, insurance/PUC dates, owner name, email and opening date. */
defined('APP') or exit;

$terms = "Km included: 280 per day (hatchback, sedan), 300 per day (SUV, 7-seater).\n"
    . "Extra km: ₹10 per km. Late return: ₹300 per hour.\n"
    . "Extensions must be told at least 12 hours before return.\n"
    . "Original Voter ID or driving licence is kept as security until return.\n"
    . "Fuel, FASTag and traffic fines are the customer's responsibility. Speed 80 to 110 km/h max.\n"
    . "Damage repair paid by the customer up to ₹50,000.";

$car = fn($name, $make, $cat, $price, $seats, $fuel, $spec, $photo, $auto = false) => [
    'name' => $name, 'make' => $make, 'category' => $cat, 'daily_rate' => $price * 100, 'seats' => $seats, 'fuel' => $fuel,
    'transmission' => $auto ? 'Automatic' : 'Manual', 'km_limit_per_day' => ['Hatchback' => 280, 'Sedan' => 280, 'Compact SUV' => 300, 'SUV' => 300, '7-seater' => 300][$cat] ?? null,
    'notes' => $spec, 'photo' => $photo,
];

return [
    'label' => 'BS Car Rentals',
    'settings' => [
        'business_name' => 'BS Car Rentals',
        'business_phone' => '91015 83341',
        'business_address' => "Chagalpara, near Manasha Mandir Path, VIP Road, Lokhra\nGuwahati, Assam 781040",
        'currency' => 'INR',
        'default_rate_type' => 'daily',
        'booking_prefix' => 'BS',
        'late_fee_per_hour' => 30000,   // ₹300 per hour
        'extra_km_rate' => 1000,        // ₹10 per km
        'categories' => "Hatchback\nSedan\nCompact SUV\nSUV\n7-seater\nScooty",
        'default_rental_terms' => $terms,
    ],
    'vehicles' => [
        $car('Maruti Suzuki Alto K10', 'Maruti Suzuki', 'Hatchback', 1500, 5, 'Petrol', '1.0 L petrol · 67 PS · 24 km/l', 'alto-k10.jpg'),
        $car('Maruti Suzuki Swift', 'Maruti Suzuki', 'Hatchback', 1800, 5, 'Petrol', '1.2 L petrol · 82 PS · 24 km/l', 'swift.jpg'),
        $car('Hyundai Grand i10 Nios', 'Hyundai', 'Hatchback', 1800, 5, 'Petrol', '1.2 L petrol · 83 PS · 18 km/l', 'grand-i10-nios.jpg'),
        $car('Hyundai i20', 'Hyundai', 'Hatchback', 2000, 5, 'Petrol', '1.2 L petrol · 83 PS · 20 km/l', 'i20.jpg'),
        $car('Maruti Suzuki Swift Dzire', 'Maruti Suzuki', 'Sedan', 2000, 5, 'Petrol', '1.2 L petrol · 82 PS · 24 km/l', 'swift-dzire.jpg'),
        $car('Hyundai Verna', 'Hyundai', 'Sedan', 2500, 5, 'Petrol', '1.5 L petrol · 115 PS · 18 km/l', 'verna.jpg'),
        $car('Tata Punch', 'Tata', 'Compact SUV', 2000, 5, 'Petrol', '1.2 L petrol · 88 PS · 20 km/l', 'punch.jpg'),
        $car('Maruti Suzuki Fronx', 'Maruti Suzuki', 'Compact SUV', 2200, 5, 'Petrol', '1.2 L petrol · 90 PS · 21 km/l', 'fronx.jpg'),
        $car('Tata Nexon', 'Tata', 'Compact SUV', 2500, 5, 'Petrol', '1.2 L turbo petrol · 120 PS · 17 km/l', 'nexon.jpg'),
        $car('Maruti Suzuki Brezza', 'Maruti Suzuki', 'Compact SUV', 2500, 5, 'Petrol', '1.5 L petrol · 103 PS · 19 km/l', 'brezza.jpg'),
        $car('Hyundai Venue', 'Hyundai', 'Compact SUV', 2500, 5, 'Petrol', '1.2 L petrol · 83 PS · 17 km/l', 'venue.jpg'),
        $car('Kia Sonet', 'Kia', 'Compact SUV', 2500, 5, 'Petrol', '1.2 L petrol · 83 PS · 18 km/l. Price on the website was not confirmed by the owner.', 'kia-sonet.jpg'),
        $car('Mahindra XUV300 (Automatic)', 'Mahindra', 'Compact SUV', 2500, 5, 'Petrol', '1.2 L turbo petrol · 110 PS · 17 km/l', 'xuv300.jpg', true),
        $car('Kia Seltos', 'Kia', 'SUV', 2700, 5, 'Petrol', '1.5 L petrol · 115 PS · 17 km/l', 'kia-seltos.jpg'),
        $car('Hyundai Creta', 'Hyundai', 'SUV', 2700, 5, 'Petrol', '1.5 L petrol · 115 PS · 17 km/l', 'creta.jpg'),
        $car('Mahindra Thar (3-door)', 'Mahindra', 'SUV', 3500, 4, 'Diesel', '2.2 L diesel · 132 PS · 15 km/l', 'thar.jpg'),
        $car('Mahindra Scorpio N', 'Mahindra', 'SUV', 4000, 7, 'Diesel', '2.2 L diesel · 175 PS · 15 km/l', 'scorpio-n.jpg'),
        $car('Mahindra XUV700', 'Mahindra', 'SUV', 4000, 7, 'Diesel', '2.2 L diesel · 185 PS · 16 km/l', 'xuv700.jpg'),
        $car('Mahindra Thar Roxx', 'Mahindra', 'SUV', 4000, 5, 'Diesel', '2.2 L diesel · 175 PS · 15 km/l', 'thar-roxx.jpg'),
        $car('Maruti Suzuki Ertiga', 'Maruti Suzuki', '7-seater', 3000, 7, 'Petrol', '1.5 L petrol · 103 PS · 20 km/l', 'ertiga.jpg'),
        $car('Kia Carens', 'Kia', '7-seater', 3000, 7, 'Petrol', '1.5 L petrol · 115 PS · 16 km/l', 'kia-carens.jpg'),
        $car('Toyota Innova Crysta', 'Toyota', '7-seater', 4000, 7, 'Diesel', '2.4 L diesel · 150 PS · 13 km/l', 'innova-crysta.jpg'),
        $car('Yamaha Aerox 155', 'Yamaha', 'Scooty', 800, 2, 'Petrol', '155 cc · 15 PS · ~40 km/l', 'aerox.jpg', true),
        $car('TVS Ntorq 125', 'TVS', 'Scooty', 700, 2, 'Petrol', '125 cc · 9.4 PS · ~45 km/l', 'ntorq.jpg', true),
        $car('Honda Activa 6G', 'Honda', 'Scooty', 600, 2, 'Petrol', '110 cc · 7.8 PS · ~50 km/l', 'activa.jpg', true),
    ],
];
