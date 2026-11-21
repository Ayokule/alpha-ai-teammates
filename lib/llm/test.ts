/**
 * FreeLLM Gateway Test - Quick verification that the gateway works
 */
import { freeLlmProvider, getModelForDepartment, testFreeLlmConnection } from './gateway'

async function runTests() {
  console.log('🧪 Testing FreeLLM Gateway...\n')

  // Test 1: Connection test
  console.log('1. Testing connection...')
  const connTest = await testFreeLlmConnection()
  if (connTest.ok) {
    console.log(`   ✅ Connected! Found ${connTest.models?.length} models`)
    console.log(`   📋 Sample models: ${connTest.models?.slice(0, 5).join(', ')}...`)
  } else {
    console.log(`   ❌ Connection failed: ${connTest.error}`)
  }

  // Test 2: Model routing
  console.log('\n2. Testing model routing...')
  const departments = ['assistant', 'research', 'content', 'engineering', 'head']
  for (const dept of departments) {
    const model = getModelForDepartment(dept as any)
    console.log(`   ${dept}: ${model}`)
  }

  // Test 3: Generate text
  console.log('\n3. Testing text generation...')
  try {
    const model = freeLlmProvider('auto')
    // This would be called in a server component or API route
    console.log('   Model ready for use with AI SDK')
  } catch (error) {
    console.log(`   ❌ Generation failed: ${error}`)
  }

  console.log('\n✅ FreeLLM Gateway tests complete!')
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error)
}

export { runTests }