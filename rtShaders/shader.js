var raytraceFS_header = `
	precision highp float;
	precision highp int;
`;

var raytraceFS_primary = `
	uniform float use_rt;

	varying vec3 ray_pos;
	varying vec3 ray_dir;

	void main()
	{
		if ( use_rt < 0.5 ) {
		 	gl_FragColor = vec4(0.8,0,0,1);
		} else {
			Ray primary_ray;
			primary_ray.pos = ray_pos;
			primary_ray.dir = ray_dir;
			gl_FragColor = RayTracer( primary_ray );
		}
	}
`;

var raytraceVS = `
attribute vec3 p;

uniform float a_use_rt;

uniform mat4 proj;
uniform mat4 c2w;
uniform mat4 w2c;
varying vec3 ray_pos;
varying vec3 ray_dir;
void main()
{
	if ( a_use_rt > 0.5 ) {
    	gl_Position = proj * vec4(p,1);
	} else {
	 	gl_Position = proj * w2c * vec4(p,1);
	}
	vec4 rp = c2w * vec4(0,0,0,1);
	ray_pos = rp.xyz;
	vec4 rd = c2w * vec4(p,1);
	ray_dir = rd.xyz - ray_pos;
}
`;

var raytraceFS = `
struct Ray {
	vec3 pos;
	vec3 dir;
};

struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};

struct Sphere {
	vec3     center;
	float    radius;
	Material mtl;
};

struct Light {
	vec3 position;
	vec3 intensity;
};

struct HitInfo {
	float    t;
	vec3     position;
	vec3     normal;
	Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

bool IntersectRay( inout HitInfo hit, Ray ray );

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	vec3 color = vec3(0,0,0);
	float bias = 1e-3;
	for ( int i=0; i<NUM_LIGHTS; ++i ) {
		// TO-DO: Check for shadows
		bool isVisible = true;
		for(int j = 0; j < NUM_SPHERES; j++){
			Ray shadowRay;
			shadowRay.pos = position;
			shadowRay.dir = normalize(lights[i].position - position);
			shadowRay.pos += shadowRay.dir * bias;
			HitInfo hit;
			if(IntersectRay(hit, shadowRay) && length(hit.position - position) < length(lights[i].position - position)){
				isVisible = false;
				break;
			}
		}
		if (!isVisible)
			continue;
		// TO-DO: If not shadowed, perform shading using the Blinn model)
		vec3 lightDir = -normalize(position - lights[i].position);
		float diffuse = max(dot(normal, lightDir), 0.0);
        vec3 halfwayDir = normalize(lightDir - view);
        float specular = pow(max(dot(normal, halfwayDir), 0.0), mtl.n);

		color += lights[i].intensity * (mtl.k_d * diffuse + mtl.k_s * specular);
	}
	return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
	hit.t = 1e30;
	bool foundHit = false;
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		// TO-DO: Test for ray-sphere intersection
		Sphere s = spheres[i];
		float a = dot(ray.dir, ray.dir);
		float b = 2.0 * dot(ray.dir, (ray.pos - s.center));
		float c = dot(ray.pos - s.center, ray.pos - s.center) - s.radius * s.radius;
		float delta = b * b - 4.0 * a * c;
		// TO-DO: If intersection is found, update the given HitInfo
		if (delta > 0.0) {
			// intersection;
			float new_t = (-b - sqrt(delta))/(2.0 * a);
			
			if (new_t < hit.t && new_t > 0.){
				foundHit = true;
				hit.t = new_t;
				hit.position = ray.pos + hit.t * ray.dir;
				hit.normal = normalize(hit.position - s.center);
				hit.mtl = s.mtl;
			}
		}
	}
	return foundHit;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		vec3 view = normalize( -ray.dir );
		vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );
		
		// Compute reflections
		vec3 k_s = hit.mtl.k_s;
		for ( int bounce=0; bounce<MAX_BOUNCES; ++bounce ) {
			if ( bounce >= bounceLimit ) break;
			if ( hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b <= 0.0 ) break;
			
			Ray r;	// this is the reflection ray
			HitInfo h;	// reflection hit info
			
			// TO-DO: Initialize the reflection ray
			r.pos = hit.position;
			r.dir = normalize(reflect(ray.dir, hit.normal));
			
			if ( IntersectRay( h, r ) ) {
				// TO-DO: Hit found, so shade the hit point
				clr += Shade(h.mtl, h.position, h.normal, -r.dir);
				// TO-DO: Update the loop variables for tracing the next reflection ray
				hit = h;
				ray = r;
			} else {
				// The refleciton ray did not intersect with anything,
				// so we are using the environment color
				clr += k_s * textureCube( envMap, r.dir.xzy ).rgb;
				break;	// no more reflections
			}
		}
		return vec4( clr, 1 );	// return the accumulated color, including the reflections
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 0 );	// return the environment color
	}
}
`;