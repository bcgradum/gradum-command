import { sbFacilities, sbAthletes, sbActivity } from "./supabase";

const FACILITIES = [
  { facility_number: 2, location_name: "Gradum Austin", address: "720 S Bell Boulevard, #6C, Cedar Park, TX 78613", city: "Cedar Park", state: "TX", zip: "78613", email: "austin@gradumgswing.com", phone: "(512) 643-6303", ig_account: "@gradumaustin", lat: 30.50231, lng: -97.81757, status: "active" },
  { facility_number: 3, location_name: "Gradum Broward", address: "1850 NW 15th Avenue, Suite 125, Pompano Beach, FL 33069", city: "Pompano Beach", state: "FL", zip: "33069", email: "broward@gradumgswing.com", phone: "(954) 242-2954", ig_account: "@gradumbroward", lat: 26.253743, lng: -80.143669, status: "active" },
  { facility_number: 4, location_name: "Gradum Carrollton", address: "2520 Tarpley Road, Suite 100, Carrollton, TX 75006", city: "Carrollton", state: "TX", zip: "75006", email: "carrollton@gradumgswing.com", phone: "(972) 440-9594", ig_account: "@gradumdallas", lat: 32.983189, lng: -96.85134, status: "active" },
  { facility_number: 5, location_name: "Gradum Cary", address: "Cary, NC 27511", city: "Cary", state: "NC", zip: "27511", email: "cary@gradumgswing.com", phone: "", ig_account: "@Gradumraleigh", lat: 35.795282, lng: -78.801712, status: "active" },
  { facility_number: 6, location_name: "Gradum Charleston", address: "Mount Pleasant, SC 29464", city: "Mount Pleasant", state: "SC", zip: "29464", email: "charleston@gradumgswing.com", phone: "", ig_account: "@gradumcharleston", lat: 32.883446, lng: -79.761203, status: "active" },
  { facility_number: 7, location_name: "Gradum Charlotte", address: "Cornelius, NC 28031", city: "Cornelius", state: "NC", zip: "28031", email: "charlotte@gradumgswing.com", phone: "", ig_account: "@GradumCharlotte", lat: 35.481705, lng: -80.859001, status: "active" },
  { facility_number: 9, location_name: "Gradum Fort Myers", address: "Fort Myers, FL 33901", city: "Fort Myers", state: "FL", zip: "33901", email: "fortmyers@gradumgswing.com", phone: "", ig_account: "@Gradumftmyers", lat: 26.640628, lng: -81.872308, status: "active" },
  { facility_number: 10, location_name: "Gradum Fort Worth", address: "Fort Worth, TX 76101", city: "Fort Worth", state: "TX", zip: "76101", email: "fortworth@gradumgswing.com", phone: "", ig_account: "@gradumfortworth", lat: 32.90964, lng: -97.258165, status: "active" },
  { facility_number: 11, location_name: "Gradum Frisco", address: "Little Elm, TX 75068", city: "Little Elm", state: "TX", zip: "75068", email: "frisco@gradumgswing.com", phone: "", ig_account: "@gradumdallas", lat: 33.154615, lng: -96.907788, status: "active" },
  { facility_number: 12, location_name: "Gradum Houston", address: "Houston, TX 77001", city: "Houston", state: "TX", zip: "77001", email: "houston@gradumgswing.com", phone: "", ig_account: "@Gradumhouston", lat: 29.834678, lng: -95.569881, status: "active" },
  { facility_number: 13, location_name: "Gradum Jacksonville", address: "Jacksonville, FL 32099", city: "Jacksonville", state: "FL", zip: "32099", email: "jacksonville@gradumgswing.com", phone: "", ig_account: "@gradumjacksonville", lat: 30.281224, lng: -81.506431, status: "active" },
  { facility_number: 14, location_name: "Gradum Jupiter", address: "Jupiter, FL 33458", city: "Jupiter", state: "FL", zip: "33458", email: "jupiter@gradumgswing.com", phone: "", ig_account: "@Gradumjupiter", lat: 26.924611, lng: -80.143698, status: "active" },
  { facility_number: 16, location_name: "Gradum Nocatee", address: "St. Augustine, FL 32095", city: "St. Augustine", state: "FL", zip: "32095", email: "nocatee@gradumgswing.com", phone: "", ig_account: "@gradumnocatee", lat: 29.894695, lng: -81.314539, status: "active" },
  { facility_number: 17, location_name: "Gradum Orlando", address: "Orlando, FL 32801", city: "Orlando", state: "FL", zip: "32801", email: "orlando@gradumgswing.com", phone: "", ig_account: "@Gradumwintergarden", lat: 28.542122, lng: -81.379045, status: "active" },
  { facility_number: 18, location_name: "Gradum Port St. Lucie", address: "Port St. Lucie, FL 34984", city: "Port St. Lucie", state: "FL", zip: "34984", email: "portstlucie@gradumgswing.com", phone: "", ig_account: "@Gradumportstlucie", lat: 27.293933, lng: -80.350328, status: "active" },
  { facility_number: 22, location_name: "Gradum South Charlotte", address: "Charlotte, NC 28201", city: "Charlotte", state: "NC", zip: "28201", email: "southcharlotte@gradumgswing.com", phone: "", ig_account: "@Gradumsouthcharlotte", lat: 35.123514, lng: -80.954087, status: "active" },
  { facility_number: 23, location_name: "Gradum South Miami", address: "Miami, FL 33101", city: "Miami", state: "FL", zip: "33101", email: "southmiami@gradumgswing.com", phone: "", ig_account: "@Gradumsouthmiami", lat: 25.774157, lng: -80.193597, status: "active" },
  { facility_number: 24, location_name: "Gradum Spring", address: "Spring, TX 77373", city: "Spring", state: "TX", zip: "77373", email: "spring@gradumgswing.com", phone: "", ig_account: "@Gradumhouston", lat: 30.079571, lng: -95.418792, status: "active" },
  { facility_number: 25, location_name: "Gradum Tampa", address: "Valrico, FL 33596", city: "Valrico", state: "FL", zip: "33596", email: "tampa@gradumgswing.com", phone: "", ig_account: "@Gradumtampa", lat: 27.937834, lng: -82.232753, status: "active" },
  { facility_number: 26, location_name: "Gradum Wake Forest", address: "Wake Forest, NC 27587", city: "Wake Forest", state: "NC", zip: "27587", email: "wakeforest@gradumgswing.com", phone: "", ig_account: "@Gradumraleigh", lat: 35.929534, lng: -78.535998, status: "active" },
  { facility_number: 27, location_name: "Gradum Wesley Chapel", address: "Lutz, FL 33549", city: "Lutz", state: "FL", zip: "33549", email: "wesleychapel@gradumgswing.com", phone: "", ig_account: "@Gradumtampa", lat: 28.151124, lng: -82.461483, status: "active" },
  // Parked
  { facility_number: 1, location_name: "Gradum Alpharetta", address: "2723 Pine Grove Road, Unit 1, Alpharetta, GA 30005", city: "Alpharetta", state: "GA", zip: "30005", email: "alpharetta@gradumgswing.com", phone: "(770) 628-5017", ig_account: null, lat: 34.075596, lng: -84.294596, status: "parked" },
  { facility_number: 8, location_name: "Gradum Edmond", address: "Edmond, OK 73003", city: "Edmond", state: "OK", zip: "73003", email: "edmonds@gradumgswing.com", phone: "", ig_account: null, lat: 35.657137, lng: -97.464904, status: "parked" },
  { facility_number: 15, location_name: "Gradum McKinney", address: "McKinney, TX 75069", city: "McKinney", state: "TX", zip: "75069", email: "mckinney@gradumgswing.com", phone: "", ig_account: null, lat: 33.230648, lng: -96.612495, status: "parked" },
  { facility_number: 19, location_name: "Gradum Salt Lake City", address: "South Jordan, UT 84095", city: "South Jordan", state: "UT", zip: "84095", email: "saltlakecity@gradumgswing.com", phone: "", ig_account: null, lat: 40.557587, lng: -111.93869, status: "parked" },
  { facility_number: 20, location_name: "Gradum San Antonio", address: "San Antonio, TX 78201", city: "San Antonio", state: "TX", zip: "78201", email: "sanantonio@gradumgswing.com", phone: "", ig_account: null, lat: 29.584373, lng: -98.582663, status: "parked" },
  { facility_number: 21, location_name: "Gradum Sarasota", address: "Sarasota, FL 34230", city: "Sarasota", state: "FL", zip: "34230", email: "sarasota@gradumgswing.com", phone: "", ig_account: null, lat: 27.336581, lng: -82.530855, status: "parked" },
];

export async function seedSupabase() {
  try {
    const existing = await sbFacilities.count();
    if (existing > 0) {
      console.log(`Supabase: ${existing} facilities already seeded, skipping`);
      return;
    }

    console.log("Seeding Supabase with facility data...");
    await sbFacilities.insert(FACILITIES);
    console.log(`✅ Seeded ${FACILITIES.length} facilities to Supabase`);

    // Add initial activity log entries
    await sbActivity.insert([
      { type: "system", message: "Gradum Command Center initialized — all 27 facilities loaded", count: 27 },
      { type: "system", message: "21 active facilities ready for pipeline runs", count: 21 },
    ]);

    console.log("✅ Supabase seeded successfully");
  } catch (err) {
    console.error("Supabase seed error:", err);
    // Don't crash — fall back to SQLite
  }
}
